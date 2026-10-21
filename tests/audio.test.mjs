import test from 'node:test';
import assert from 'node:assert/strict';
import {ForestAudio,LearnerSound} from '../source/audio.js';

class Parameter {
  constructor(){this.value=0;this.points=[];}
  setValueAtTime(value,at){this.value=value;this.points.push({value,at});}
  linearRampToValueAtTime(value,at){this.points.push({value,at});}
  exponentialRampToValueAtTime(value,at){assert.ok(value>0);this.points.push({value,at});}
  setTargetAtTime(value,at){this.value=value;this.points.push({value,at});}
}
class Node {
  constructor(){this.gain=new Parameter();this.frequency=new Parameter();this.disconnected=false;}
  connect(node){this.connected=node;}
  disconnect(){this.disconnected=true;}
  start(at){this.startAt=at;}
  stop(at){this.stopAt=at??0;if(at===undefined){this.cancelled=true;this.onended?.();}}
}
class Context {
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.oscillators=[];}
  createGain(){return new Node();}
  createOscillator(){const node=new Node();this.oscillators.push(node);return node;}
  resume(){this.state='running';this.onstatechange?.();return Promise.resolve();}
  suspend(){this.state='suspended';this.onstatechange?.();return Promise.resolve();}
  advance(dt){
    this.currentTime+=dt;
    for(const node of this.oscillators)if(!node.disconnected&&node.stopAt<=this.currentTime)node.onended?.();
  }
}
function harness(){
  const context=new Context(),pending=new Map();let serial=0,created=0;
  const audio=new ForestAudio({contextFactory:()=>{created++;return context;},schedule:fn=>{const id=++serial;pending.set(id,fn);return id;},cancel:id=>pending.delete(id)});
  function advance(seconds){
    for(let t=0;t<seconds;t+=.08){context.advance(.08);const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn());}
  }
  return {audio,context,pending,advance,get created(){return created;}};
}

test('music waits for a gesture and runs a single bounded scheduler',async()=>{
  const h=harness();h.audio.setScene(true);
  assert.equal(h.created,0);assert.equal(h.pending.size,0);assert.equal(h.audio.effect('eat'),false);
  await h.audio.unlock();assert.equal(h.created,1);assert.equal(h.pending.size,1);
  for(let i=0;i<100;i++)h.audio.setScene(true);
  assert.equal(h.pending.size,1);
  h.advance(90);assert.ok(h.context.oscillators.length>150);
  assert.ok(h.audio.voices.size<16);assert.equal(h.pending.size,1);
  for(const node of h.context.oscillators){
    assert.ok(Number.isFinite(node.startAt));assert.ok(node.stopAt>node.startAt);
    for(const point of [...node.frequency.points])assert.ok(Number.isFinite(point.value)&&point.value>0);
  }
  h.audio.setScene(false);assert.equal(h.pending.size,0);assert.equal(h.audio.voices.size,0);
});

test('music and effects mute independently, and zero volume stops every voice',async()=>{
  const h=harness();await h.audio.unlock();h.audio.setScene(true);
  h.audio.configure({music:false});assert.equal(h.pending.size,0);
  assert.equal(h.audio.effect('eat'),true);assert.ok([...h.audio.voices].every(v=>v.kind==='effect'));
  h.audio.configure({effects:false});assert.equal(h.audio.voices.size,0);
  const count=h.context.oscillators.length;assert.equal(h.audio.effect('jump'),false);assert.equal(h.context.oscillators.length,count);
  h.audio.configure({music:true});assert.equal(h.pending.size,1);assert.ok(h.audio.voices.size>0);
  h.audio.configure({volume:0});assert.equal(h.pending.size,0);assert.equal(h.audio.voices.size,0);
  h.audio.configure({volume:2});assert.equal(h.audio.volume,1);assert.equal(h.pending.size,1);
  h.audio.configure({volume:-4});assert.equal(h.audio.volume,0);
  h.audio.configure({volume:NaN});assert.equal(h.audio.volume,0);
});

test('pause, home and background cancel queued notes; resume never duplicates the loop',async()=>{
  const h=harness();await h.audio.unlock();h.audio.setScene(true);h.audio.effect('mission');
  h.audio.setScene(false);assert.equal(h.audio.voices.size,0);assert.equal(h.pending.size,0);
  h.audio.setScene(true);h.audio.effect('eat');h.audio.setScene(false,false);
  assert.equal(h.context.state,'suspended');assert.equal(h.audio.voices.size,0);assert.equal(h.pending.size,0);
  assert.equal(h.audio.effect('correct'),false);
  h.audio.setScene(false,true);assert.equal(h.pending.size,0);
  await h.audio.unlock();h.audio.setScene(true);await h.audio.unlock();assert.equal(h.pending.size,1);
  h.audio.setScene(false);h.advance(2);assert.equal(h.audio.voices.size,0);assert.equal(h.pending.size,0);
  h.audio.effect('finish');assert.ok(h.audio.voices.size>0);
  h.audio.silence();assert.equal(h.audio.voices.size,0);assert.equal(h.pending.size,0);
});

test('rapid cues are debounced and concurrent voices have a hard limit',async()=>{
  const h=harness();await h.audio.unlock();
  assert.equal(h.audio.effect('eat'),true);const count=h.context.oscillators.length;
  for(let i=0;i<100;i++)assert.equal(h.audio.effect('eat'),false);
  assert.equal(h.context.oscillators.length,count);
  for(let i=0;i<100;i++){
    h.context.currentTime+=.13;
    for(const name of ['start','eat','jump','tongue','hide','dive','caught','mission','correct','retry','round','finish'])h.audio.effect(name);
    assert.ok(h.audio.voices.size<=48);
  }
  h.audio.setScene(false,false);assert.equal(h.audio.voices.size,0);
});

test('an absent or rejected audio API leaves the game usable',async()=>{
  for(const contextFactory of [()=>null,()=>{throw new Error('unavailable');}]){
    const audio=new ForestAudio({contextFactory});audio.setScene(true);
    assert.equal(await audio.unlock(),false);assert.equal(audio.available,false);
    assert.equal(audio.effect('eat'),false);audio.configure({volume:0});audio.setScene(false,false);
  }
  const context=new Context();context.resume=()=>Promise.reject(new Error('gesture blocked'));
  const audio=new ForestAudio({contextFactory:()=>context});audio.setScene(true);
  assert.equal(await audio.unlock(),false);assert.equal(audio.musicRunning,false);assert.equal(audio.timer,null);
});

test('only learner events are heard, each event and mission is announced once',()=>{
  const sounds=[],observer=new LearnerSound({effect:name=>sounds.push(name)});
  const world={phase:'playing',round:0,serial:6,events:[
    {id:1,type:'rice',hunter:'bot1'},
    {id:2,type:'catch',hunter:'bot2',prey:'bot1'},
    {id:3,type:'rice',hunter:'me'},
    {id:4,type:'skill',hunter:'me',role:0},
    {id:5,type:'catch',hunter:'me',prey:'bot3'},
    {id:6,type:'catch',hunter:'bot2',prey:'me'}
  ]};
  observer.observe(world,{complete:false});assert.deepEqual(sounds,['eat','jump','eat','caught']);
  observer.observe(world,{complete:true});observer.observe(world,{complete:true});
  assert.deepEqual(sounds,['eat','jump','eat','caught','mission']);
  world.phase='between';observer.observe(world,{complete:true});observer.observe(world,{complete:true});
  assert.equal(sounds.filter(s=>s==='round').length,1);
  for(let role=1;role<4;role++){
    world.round=role;world.phase='playing';world.events=[{id:++world.serial,type:'skill',hunter:'me',role}];
    observer.observe(world,{complete:true});
  }
  assert.equal(sounds.filter(s=>s==='mission').length,4);
  for(const name of ['tongue','hide','dive'])assert.ok(sounds.includes(name));
  observer.reset();world.round=0;world.serial=1;world.events=[{id:1,type:'rice',hunter:'me'}];
  observer.observe(world,{complete:false});assert.equal(sounds.at(-1),'eat');
});

test('pending learner events do not make sounds while paused',()=>{
  const sounds=[],observer=new LearnerSound({effect:name=>sounds.push(name)});
  const world={phase:'paused',round:0,serial:1,events:[{id:1,type:'rice',hunter:'me'}]};
  observer.observe(world,{complete:true});assert.equal(sounds.length,0);
  world.phase='playing';observer.observe(world,{complete:true});assert.deepEqual(sounds,['mission']);
});
