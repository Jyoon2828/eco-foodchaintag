import test from 'node:test';
import assert from 'node:assert/strict';
import {SoloSession} from '../source/solo-state.js';
import {QUIZZES} from '../source/quiz.js';
import {step,hideProtected,missionFor} from '../source/engine.js';

function endRound(session){for(let n=0;n<1300&&session.world.phase==='playing';n++)session.tick({},.1);assert.equal(session.world.phase,'between');}
test('one learner starts with twelve computer companions and no class membership',()=>{
  const s=new SoloSession();s.start();const all=Object.values(s.world.players);
  assert.equal(all.filter(p=>!p.bot).length,1);assert.equal(all.filter(p=>p.bot).length,12);
  for(let role=0;role<4;role++)assert.equal(all.filter(p=>p.bot&&p.role===role).length,[4,3,3,2][role]);
  assert.equal(s.world.duration,90);assert.equal(s.me.role,0);
});
test('local instances are independent and settings set actual time and population',()=>{
  const a=new SoloSession(),b=new SoloSession();a.start(60,2);b.start(120,4);
  assert.equal(Object.keys(a.world.players).length,9);assert.equal(Object.keys(b.world.players).length,17);
  a.me.score=7;assert.equal(b.me.score,0);assert.notEqual(missionFor(a.me,60).goal,missionFor(b.me,120).goal);
});
test('pause freezes the local clock and player until explicitly resumed',()=>{
  const s=new SoloSession();s.start();assert.equal(s.pause(),true);const before=JSON.stringify(s.world);
  for(let n=0;n<60;n++)s.tick({x:1},1/60);assert.equal(JSON.stringify(s.world),before);
  assert.equal(s.resume(),true);s.tick({x:1},1/60);assert.ok(s.world.t>0);
});
test('one round records the mission once and the correct quiz gates the next role',()=>{
  const s=new SoloSession();s.start(30,0);s.me.fed=2;endRound(s);
  assert.equal(s.records.length,1);assert.equal(s.records[0].count,2);assert.equal(s.records[0].complete,true);
  assert.equal(s.next(),false);assert.equal(s.answer(['grasshopper','rice']),false);assert.equal(s.next(),false);
  assert.equal(s.answer(QUIZZES[0].chain),true);assert.equal(s.records.length,1);
  assert.equal(s.next(),true);assert.equal(s.me.role,1);assert.equal(s.me.fed,0);
});
test('all four roles finish with their own records, quizzes and adjusted food populations',()=>{
  const s=new SoloSession();s.start(30,3);
  for(let role=0;role<4;role++){
    assert.equal(s.me.role,role);endRound(s);assert.equal(s.answer(QUIZZES[role].chain),true);assert.equal(s.next(),true);
  }
  assert.equal(s.finished,true);assert.equal(s.world.phase,'finished');assert.deepEqual(s.records.map(r=>r.role),[0,1,2,3]);
  assert.equal(Object.values(s.world.players).filter(p=>p.bot).length,17);assert.equal(s.me.visited.length,4);
});
test('restarting clears all personal records and fresh companions appear',()=>{
  const s=new SoloSession();s.start(30,2);s.me.fed=4;s.me.score=4;endRound(s);s.start();
  assert.equal(s.me.score,0);assert.equal(s.me.fed,0);assert.deepEqual(s.records,[]);assert.equal(s.world.round,0);
});
test('solo cover blocks catches for three seconds and expires while staying hidden',()=>{
  const s=new SoloSession();s.start(90,0);const p=s.me;
  Object.assign(p,{x:320,y:250,protect:0});for(let n=0;n<179;n++)s.tick({},1/60);
  assert.equal(hideProtected(p),true);s.tick({},1/60);assert.equal(p.hideTime,3);assert.equal(hideProtected(p),false);
});
test('solo jump crosses a tree even with no continued movement input',()=>{
  const s=new SoloSession();s.start(90,0);Object.assign(s.me,{x:600,y:190,angle:Math.PI/2});
  s.tick({action:1},1/60);for(let n=0;n<45;n++)s.tick({},1/60);
  assert.ok(s.me.y>500);assert.equal(s.me.effect,0);
});
test('the ready and completed screens do not advance time or AI',()=>{
  const s=new SoloSession(),before=JSON.stringify(s.world);s.tick({x:1},.1);assert.equal(JSON.stringify(s.world),before);
  s.world.phase='finished';const time=s.world.t;step(s.world,{},.1);assert.equal(s.world.t,time);
});
