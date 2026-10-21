import net from 'node:net';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import * as D from 'firebase/database';
import {Network} from '../network.js';
import {createWorld,syncMembers,startRound,step,packWorld} from '../engine.js';
import {unpackRealtimeWorld,INPUT_MAX_AGE_MS,WORLD_INTERVAL_MS,HOST_HEARTBEAT_MS} from '../sync.js';

// Measure local RTDB protocol bytes, including its WebSocket frames, through a
// loopback TCP proxy. TLS, public-internet reconnects and real billing are absent.
const endpoint=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if(!endpoint)throw new Error('A local database emulator is required; production is never used.');
const [backendHost,backendPort]=endpoint.split(':'),proxyPort=Number(backendPort)+1;
assert.ok(['127.0.0.1','localhost'].includes(backendHost));
const sockets=new Set();let outboundBytes=0;
const proxy=net.createServer(down=>{
  sockets.add(down);const up=net.connect({host:backendHost,port:Number(backendPort)});
  up.on('data',data=>{outboundBytes+=data.length;down.write(data);});
  down.on('data',data=>up.write(data));
  up.on('error',()=>down.destroy());down.on('error',()=>up.destroy());
  down.on('close',()=>{sockets.delete(down);up.destroy();});up.on('close',()=>down.destroy());
});
await new Promise(resolve=>proxy.listen(proxyPort,'127.0.0.1',resolve));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){const end=Date.now()+6000;while(Date.now()<end){if(check())return;await pause(25);}throw new Error(message);}
const stageMs=Number(process.env.LOAD_STAGE_MS)||3000;
const results=[],reportUrl=new URL('../USAGE_CHECK.json',import.meta.url);
if(process.env.LOAD_RESUME==='1')try{const prior=JSON.parse(readFileSync(reportUrl,'utf8'));if(prior.measurementVersion===2)results.push(...prior.results);}catch{}
function saveReport(){writeFileSync(reportUrl,JSON.stringify({date:'2026-10-21',kind:'local-emulator-protocol-measurement',measurementVersion:2,complete:results.length===7,results},null,2));}
async function run(students,optimized,bots=2){
  const before=outboundBytes;
  const classId=`load_${students}_${optimized?'after':'before'}_${bots}`;
  const env=await initializeTestEnvironment({projectId:'demo-foodtag',database:{host:'127.0.0.1',port:proxyPort,rules:readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});
  const networks=[],errors=[],pending=new Set();let inputs={},members={},worldBusy=false,lastWorld=0,lastBeat=0,lastMemberSync=0,inputWrites=0,worldWrites=0;
  const tracked=p=>{pending.add(p);p.catch(e=>errors.push(String(e))).finally(()=>pending.delete(p));return p;};
  function network(uid,provider){
    const n=new Network(classId,e=>errors.push(String(e)));n.D=D;n.auth={currentUser:{uid}};
    n.db=env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database();networks.push(n);return n;
  }
  try{
    await env.clearDatabase();
    const epoch='load-lesson';
    await env.withSecurityRulesDisabled(c=>c.database().ref(`foodTag/${classId}`).set({owner:'teacher',meta:{epoch,hostOnline:true,hostBeat:Date.now()}}));
    const teacher=network('teacher','password'),world=createWorld(180,bots),clients=[];
    teacher.watch('members',v=>members=v||{});teacher.watch('inputs',v=>inputs=v||{});teacher.watch('world',()=>{});teacher.watch('boards',()=>{});teacher.watch('meta',()=>{});
    await Promise.all(Array.from({length:students},async(_,i)=>{
      const uid=`learner_${String(i+1).padStart(28,'0')}`,n=network(uid,'anonymous');
      await n.presence({group:Math.floor(i/6)+1,seat:i%6+1,skin:i%3,joinedAt:i+1},epoch);
      clients.push({n,index:i,lastInput:0,busy:false,updates:0,latest:null});
    }));
    // A writer's acknowledgement may precede another connection's listener.
    // Wait for the teacher to see every join, as the actual lobby does.
    await until(()=>Object.values(members).filter(m=>m.online).length===students,'The teacher did not receive all member joins.');
    syncMembers(world,members);startRound(world);
    for(let t=0;t<160;t++)step(world,{},.05);
    const publish=async()=>{
      const changed=optimized?await teacher.publishWorld(world):(await teacher.set('world',packWorld(world)),true);
      if(changed)worldWrites++;
    };
    await publish();
    for(const client of clients){
      client.n.watch('world',p=>{if(p){client.latest=unpackRealtimeWorld(p);client.updates++;}});
      client.n.watch('meta',()=>{});
      if(optimized)client.n.watch(`boards/${Math.floor(client.index/6)+1}`,()=>{});
      else{client.n.watch('members',()=>{});client.n.watch('boards',()=>{});}
    }
    await until(()=>clients.every(c=>c.latest&&Object.keys(c.latest.players).length===students+bots*4),'Not every student received the initial world.');
    for(const c of clients)assert.equal(Object.keys(c.latest.players).length,students+bots*4);
    const initialBytes=outboundBytes-before;
    async function stage(phase){
      const beforeTransition=outboundBytes;
      world.phase=phase;await publish();await pause(120);
      const transitionBytes=outboundBytes-beforeTransition;
      const bytes=outboundBytes,started=Date.now(),writes=worldWrites,inputCount=inputWrites;
      while(Date.now()-started<stageMs){
        const now=Date.now(),elapsed=now-started;
        if(now-lastMemberSync>=700){lastMemberSync=now;syncMembers(world,members);}
        if(phase==='playing')for(const c of clients){
          if(c.busy||!optimized&&now-c.lastInput<150)continue;
          const angle=((Math.floor(elapsed/900)+c.index)%8)*Math.PI/4;
          const value={x:Math.cos(angle),y:Math.sin(angle),action:Math.floor(elapsed/1500)+1};
          c.lastInput=now;c.busy=true;
          tracked((optimized?c.n.sendInput(value,epoch):c.n.set(`inputs/${c.n.uid}`,{...value,epoch,at:D.serverTimestamp()}).then(()=>true)).then(changed=>{if(changed)inputWrites++;}).finally(()=>c.busy=false));
        }
        const maxAge=optimized?INPUT_MAX_AGE_MS:650;
        step(world,Object.fromEntries(Object.entries(inputs).filter(([,v])=>v.epoch===epoch&&now-v.at<maxAge)),.05);
        if(!worldBusy&&now-lastWorld>=(phase==='playing'?(optimized?WORLD_INTERVAL_MS:150):1000)){
          lastWorld=now;worldBusy=true;tracked(publish().finally(()=>worldBusy=false));
        }
        if(now-lastBeat>=(optimized?HOST_HEARTBEAT_MS:2200)){
          lastBeat=now;tracked(teacher.update('meta',{hostOnline:true,hostBeat:now}));
        }
        await pause(50);
      }
      await Promise.all([...pending]);await pause(100);
      return {bytes:outboundBytes-bytes,ms:Date.now()-started,worldWrites:worldWrites-writes,inputWrites:inputWrites-inputCount,transitionBytes};
    }
    const active1=await stage('playing'),idle=await stage('paused'),active2=await stage('playing');
    assert.deepEqual(errors,[]);for(const c of clients){assert.ok(c.updates>10);assert.equal(c.latest.phase,'playing');assert.equal(Object.keys(c.latest.players).length,students+bots*4);}
    const active={bytes:active1.bytes+active2.bytes,ms:active1.ms+active2.ms,worldWrites:active1.worldWrites+active2.worldWrites,inputWrites:active1.inputWrites+active2.inputWrites};
    const activeBytesPerSecond=active.bytes/active.ms*1000,idleBytesPerSecond=idle.bytes/idle.ms*1000;
    const transitionsBytes=Math.max(active1.transitionBytes,idle.transitionBytes,active2.transitionBytes)*8;
    const result={students,bots,connections:students+1,optimized,initialBytes,active,idle,transitionsBytes,activeBytesPerSecond,idleBytesPerSecond,estimated40MinuteClassBytes:initialBytes+activeBytesPerSecond*360+idleBytesPerSecond*2040+transitionsBytes,estimated40MinutesContinuousBytes:initialBytes+activeBytesPerSecond*2400,notes:'Local protocol bytes; estimates use 4 x 90-second rounds, 34 minutes waiting/discussion and eight phase changes. Transition traffic is separated from steady idle traffic. Public TLS/reconnect overhead and existing account usage are excluded.'};
    results.push(result);saveReport();console.log(JSON.stringify(result));
  }finally{for(const n of networks)n.dispose();await env.cleanup();await pause(80);}
}
try{
  for(const students of [25,31,36])for(const optimized of [false,true])if(!results.some(r=>r.students===students&&r.optimized===optimized&&r.bots===2))await run(students,optimized);
  if(!results.some(r=>r.students===36&&r.optimized&&r.bots===4))await run(36,true,4);
  saveReport();
}finally{for(const s of sockets)s.destroy();await new Promise(resolve=>proxy.close(resolve));}
