import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stableFacing,gaitPose} from '../motion-view.js';
import {createWorld,addPlayer,startRound,step,advanceMotion,ROLES,dist} from '../engine.js';

test('small changes near diagonal boundaries keep a stable sprite direction',()=>{
  let previous;
  const directions=[];
  for(let i=0;i<100;i++){previous=stableFacing(Math.PI/4+(i%2?.02:-.02),previous);directions.push(previous);}
  assert.equal(new Set(directions).size,1);
  assert.notEqual(stableFacing(Math.PI,previous),previous);
});
test('calm walking has no vertical snake bouncing or abrupt movement pose switch',()=>{
  for(let phase=0;phase<20;phase+=.1){
    assert.equal(gaitPose(2,phase,1,100).lift,0);
    assert.ok(gaitPose(0,phase,1,100).lift<=1.3);
    assert.ok(gaitPose(1,phase,1,100).lift<=2.8);
  }
  assert.ok(Math.abs(gaitPose(3,0,0,110).lift-gaitPose(3,0,0,100).lift)<.03);
});
test('computer animals move more slowly while learner speed and jump remain unchanged',()=>{
  for(let role=0;role<4;role++){
    const world=createWorld(90,0),person=addPlayer(world,'person'),bot=addPlayer(world,'bot',{},true);startRound(world);
    for(const p of [person,bot])Object.assign(p,{role,x:700,y:450,effect:0,protect:0});
    advanceMotion(person,{x:1},.05);advanceMotion(bot,{x:1},.05);
    assert.ok(bot.x<person.x);assert.ok(Math.abs(person.x-700-ROLES[role].speed*.05)<1e-7);
  }
});
test('31 learners and twelve computer friends finish four roles without extra population',()=>{
  const w=createWorld(30,3);for(let i=0;i<31;i++)addPlayer(w,'p'+i,{group:i%6+1});
  for(let round=0;round<4;round++){
    startRound(w,round);assert.equal(Object.values(w.players).filter(p=>p.bot).length,12);
    for(let tick=0;tick<610&&w.phase==='playing';tick++){
      step(w,Object.fromEntries(Array.from({length:31},(_,i)=>['p'+i,{x:Math.sin(tick/19+i),y:Math.cos(tick/23+i),action:Math.floor(tick/80)}])),.05);
    }
    assert.equal(w.phase,'between');
  }
  for(const p of Object.values(w.players)){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(p.visited.length,4);}
});
test('computer heading changes stay gradual during pursuit and obstacle avoidance',()=>{
  const w=createWorld(90,2);addPlayer(w,'learner');startRound(w);let previous=new Map();
  for(let tick=0;tick<600;tick++){
    step(w,{},.05);
    for(const p of Object.values(w.players).filter(p=>p.bot)){
      const old=previous.get(p.id);
      if(old&&!p.respawn&&!old.respawn&&dist(old,p)<30){
        const turn=Math.abs(Math.atan2(Math.sin(p.angle-old.angle),Math.cos(p.angle-old.angle)));
        assert.ok(turn<=.225+1e-7,'AI reversed direction abruptly');
      }
      previous.set(p.id,{x:p.x,y:p.y,angle:p.angle,respawn:p.respawn});
    }
  }
});
test('offline practice embeds the delivered class modules and has no food-web game',()=>{
  const html=readFileSync(new URL('../demo.html',import.meta.url),'utf8');
  for(const name of ['engine.js','motion-view.js','render.js','quiz.js','quiz-view.js','audio.js']){
    const source=readFileSync(new URL('../'+name,import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+/g,'');
    if(name!=='render.js')assert.ok(html.includes(source),name+' is stale in demo');
  }
  assert.equal(/WebHunt|food-web\.js|web-hunt|gstatic\.com|firebase-database\.js/.test(html),false);
  assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|@import\s/.test(html),false);
  const ids=[...html.slice(0,html.indexOf('<script>')).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});
