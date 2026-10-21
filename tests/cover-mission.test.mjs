import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,addPlayer,startRound,step,hideProtected,visibleTo,missionFor,groupSummary,packWorld,unpackWorld} from '../engine.js';
import {packRealtimeWorld,unpackRealtimeWorld} from '../sync.js';

function pair(x=320,y=250){
  const world=createWorld(90,0),prey=addPlayer(world,'prey'),hunter=addPlayer(world,'hunter');
  startRound(world);world.plants=[];
  Object.assign(prey,{x,y,protect:0});Object.assign(hunter,{x:x+20,y,protect:0});
  return {world,prey,hunter};
}
for(const [name,x,y] of [['reeds',320,250],['tree',600,350]])test(`${name} protects against contact for three seconds, then permits a catch`,()=>{
  const {world,prey,hunter}=pair(x,y);
  for(let n=0;n<59;n++)step(world,{},.05);
  assert.equal(prey.hidden,true);assert.equal(prey.caught,0);assert.equal(hideProtected(prey),true);
  step(world,{},.05);
  assert.equal(prey.hideTime,3);assert.equal(prey.caught,1);assert.equal(hunter.fed,1);
});
test('frog tongue cannot bypass the three-second hiding protection',()=>{
  const {world,prey,hunter}=pair();hunter.x=200;hunter.angle=0;
  step(world,{hunter:{x:1,action:1}},.05);
  assert.equal(prey.caught,0);assert.equal(hideProtected(prey),true);
});
test('expired hiding becomes visible even behind a tree',()=>{
  const viewer={id:'viewer',x:500,y:280},target={id:'target',x:700,y:280,hidden:true,hideTime:2.9};
  assert.equal(visibleTo(viewer,target),false);
  target.hideTime=3;assert.equal(visibleTo(viewer,target),true);
});
test('moving briefly within cover does not renew its protection',()=>{
  const {world,prey,hunter}=pair();hunter.online=false;
  for(let n=0;n<60;n++)step(world,{},.05);
  step(world,{prey:{x:1}},.05);step(world,{},.05);
  assert.equal(prey.hidden,true);assert.equal(hideProtected(prey),false);
});
test('leaving cover for a full second rearms protection; a brief exit does not',()=>{
  const {world,prey,hunter}=pair();hunter.online=false;
  for(let n=0;n<60;n++)step(world,{},.05);
  prey.x=760;prey.y=450;for(let n=0;n<10;n++)step(world,{},.05);
  prey.x=320;prey.y=250;step(world,{},.05);assert.equal(hideProtected(prey),false);
  prey.x=760;prey.y=450;for(let n=0;n<20;n++)step(world,{},.05);
  prey.x=320;prey.y=250;step(world,{},.05);assert.equal(hideProtected(prey),true);
});
test('pausing freezes hiding protection, and respawning grants a fresh cover budget',()=>{
  const {world,prey,hunter}=pair();hunter.online=false;
  step(world,{},.1);const time=prey.hideTime;
  world.phase='paused';for(let n=0;n<100;n++)step(world,{},.1);assert.equal(prey.hideTime,time);
  world.phase='playing';prey.hideTime=3;prey.respawn=.05;step(world,{},.05);assert.equal(prey.hideTime,0);
});
test('90-second missions use separate role goals and scale with round duration',()=>{
  assert.deepEqual([0,1,2,3].map(role=>missionFor({role},90).goal),[5,3,2,2]);
  for(const duration of [30,60,120,180])for(let role=0;role<4;role++)assert.ok(missionFor({role},duration).goal>=1);
  assert.ok(missionFor({role:0},60).goal<missionFor({role:0},120).goal);
});
test('rice increments only the current grasshopper mission and respects regrowth',()=>{
  const world=createWorld(90,0),p=addPlayer(world,'p');startRound(world);
  Object.assign(p,{x:180,y:170,protect:0});step(world,{},.05);
  assert.equal(p.fed,1);assert.equal(missionFor(p,90).complete,false);
  step(world,{},.05);assert.equal(p.fed,1);
});
test('each predator advances its own mission by eating the correct prey',()=>{
  for(let role=1;role<4;role++){
    const {world,prey,hunter}=pair(760,450);prey.role=role-1;hunter.role=role;
    step(world,{},.05);assert.equal(hunter.fed,1);assert.equal(prey.fed,0);
  }
});
test('being caught preserves mission progress; a new role resets it',()=>{
  const {world,prey}=pair(760,450);prey.fed=2;step(world,{},.05);
  for(let n=0;n<51;n++)step(world,{},.05);
  assert.equal(prey.fed,2);startRound(world,1);assert.equal(prey.fed,0);assert.equal(prey.role,1);
});
test('completed missions appear in group summaries and both packet formats',()=>{
  const {world,prey}=pair();Object.assign(prey,{fed:5,hidden:true,hideTime:3,hideAway:.5});
  assert.equal(missionFor(prey,90).complete,true);assert.equal(groupSummary(world)[0].missions,1);
  for(const copy of [unpackWorld(packWorld(world)),unpackRealtimeWorld(packRealtimeWorld(world))]){
    for(const key of ['fed','hideTime','hideAway'])assert.equal(copy.players.prey[key],prey[key]);
    assert.equal(hideProtected(copy.players.prey),false);
  }
});
test('older realtime rows load with safe defaults for new counters',()=>{
  const {world}=pair(),packet=packRealtimeWorld(world);
  packet.motion=packet.motion.split(';').map(row=>row.split(',').slice(0,16).join(',')).join(';');
  const copy=unpackRealtimeWorld(packet);
  assert.equal(copy.players.prey.fed,0);assert.equal(copy.players.prey.hideTime,0);
});
