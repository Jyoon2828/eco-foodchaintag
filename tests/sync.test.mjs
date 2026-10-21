import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,addPlayer,startRound,step,packWorld} from '../engine.js';
import {packRealtimeWorld,unpackRealtimeWorld,worldPatch,normalizeInput,inputDue,INPUT_KEEPALIVE_MS} from '../sync.js';
import {Network} from '../network.js';

function scene(){
  const world=createWorld(90,2);
  for(let i=0;i<31;i++)addPlayer(world,`student_${String(i).padStart(28,'0')}`,{group:i%6+1,label:`${i%6+1}모둠 ${i+1}번`,skin:i%3});
  startRound(world);
  for(let t=0;t<240;t++)step(world,Object.fromEntries(Object.values(world.players).filter(p=>!p.bot).map((p,i)=>[p.id,{x:Math.sin(t/10+i),y:Math.cos(t/13+i),action:Math.floor(t/35)}])),.05);
  return world;
}
test('realtime packet preserves all players, plants, teaching records and three event types',()=>{
  const world=scene(),ids=Object.keys(world.players);
  world.events=[{id:1,type:'skill',hunter:ids[0],role:0,at:11.1,x:123.4,y:234.5},{id:2,type:'rice',hunter:ids[1],from:-1,to:0,at:11.2,x:180,y:170},{id:3,type:'catch',hunter:ids[2],prey:ids[3],from:0,to:1,at:11.3,x:700,y:600}];
  const copy=unpackRealtimeWorld(JSON.parse(JSON.stringify(packRealtimeWorld(world))));
  assert.equal(Object.keys(copy.players).length,39);assert.deepEqual(copy.events,world.events);
  for(const [id,p]of Object.entries(world.players)){
    const q=copy.players[id];
    for(const key of ['id','base','role','group','label','bot','online','skin','score','caught','hidden','actionSeq','fed'])assert.equal(q[key],p[key],key);
    for(const key of ['x','y','angle','cool','effect','protect','respawn','eatWait','hideTime','hideAway'])assert.ok(Math.abs(q[key]-p[key])<=.051,key);
    assert.deepEqual(q.learned,p.learned);assert.deepEqual(q.visited,p.visited);
  }
  assert.equal(copy.phase,world.phase);assert.equal(copy.round,world.round);
  assert.deepEqual(copy.plants.map(p=>[p.id,p.x,p.y]),world.plants.map(p=>[p.id,p.x,p.y]));
});
test('legacy packets and Firebase omission of empty collections remain readable',()=>{
  const w=createWorld();addPlayer(w,'p');
  assert.equal(unpackRealtimeWorld(packWorld(w)).players.p.label,'탐험가');
  const p=packRealtimeWorld(createWorld());delete p.roster;delete p.events;
  const q=unpackRealtimeWorld(p);assert.deepEqual(q.players,{});assert.deepEqual(q.events,[]);assert.equal(q.plants.length,24);
});
test('idle scenes produce no write and moving updates omit static names and terrain',()=>{
  const world=scene(),before=packRealtimeWorld(world);
  assert.equal(worldPatch(before,packRealtimeWorld(world)),null);
  world.players[Object.keys(world.players)[0]].x+=10;world.t+=.25;world.remaining-=.25;
  const next=packRealtimeWorld(world),patch=worldPatch(before,next);
  assert.deepEqual(Object.keys(patch).sort(),['clock','motion']);
  assert.deepEqual(unpackRealtimeWorld({...before,...patch}),unpackRealtimeWorld(next));
  assert.ok(Buffer.byteLength(JSON.stringify(patch))<Buffer.byteLength(JSON.stringify(packWorld(world)))*.4);
});
test('roster changes atomically preserve player and event identities',()=>{
  const world=scene(),old=packRealtimeWorld(world),first=Object.keys(world.players)[0];
  world.events=[{id:7,type:'rice',hunter:first,from:-1,to:0,x:180,y:170,at:5}];
  addPlayer(world,'aaa_newcomer',{group:6,label:'새 친구'});
  const next=packRealtimeWorld(world),patch=worldPatch(old,next),copy=unpackRealtimeWorld({...old,...patch});
  assert.equal(copy.events[0].hunter,first);assert.equal(copy.players.aaa_newcomer.label,'새 친구');assert.equal(Object.keys(copy.players).length,40);
});
test('idle inputs stop repeating while movement keeps alive and stop/action are immediate',()=>{
  const prev={x:0,y:0,action:0,epoch:'a',sentAt:1000};
  assert.equal(inputDue(prev,normalizeInput({x:0,y:0,action:0}),'a',100000),false);
  assert.equal(inputDue({...prev,x:1},{x:1,y:0,action:0},'a',1000+INPUT_KEEPALIVE_MS-1),false);
  assert.equal(inputDue({...prev,x:1},{x:1,y:0,action:0},'a',1000+INPUT_KEEPALIVE_MS),true);
  assert.equal(inputDue({...prev,x:1},{x:0,y:0,action:0},'a',1001),true);
  assert.equal(inputDue(prev,{x:0,y:0,action:1},'a',1001),true);
  assert.equal(inputDue(prev,{x:0,y:0,action:0},'b',1001),true);
});
test('world publication skips identical data, retries failure and serializes phase changes',async()=>{
  const n=new Network('test'),world=scene(),writes=[];
  n.set=async(path,data)=>writes.push({type:'set',path,data});n.update=async(path,data)=>writes.push({type:'update',path,data});
  assert.equal(await n.publishWorld(world),true);assert.equal(await n.publishWorld(world),false);assert.equal(writes.length,1);
  world.phase='paused';const pause=n.publishWorld(world);world.phase='playing';const play=n.publishWorld(world);await Promise.all([pause,play]);
  assert.equal(writes[1].data.clock[3],'paused');assert.equal(writes[2].data.clock[3],'playing');
  const original=n.update;n.update=async()=>{throw new Error('offline');};world.phase='between';
  await assert.rejects(n.publishWorld(world),/offline/);n.update=original;assert.equal(await n.publishWorld(world),true);
});
