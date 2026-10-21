import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionView,SIMULATION_STEP,stableFacing,gaitPose} from '../source/motion-view.js';
import {SoloSession} from '../source/solo-state.js';
import {ROLES,OBSTACLES,startRound,dist,advanceMotion,findPath,missionFor,canEat,hideProtected} from '../source/engine.js';

function motion(fps){
  const s=new SoloSession();s.start(90,0);Object.assign(s.me,{x:100,y:100});
  const view=new MotionView(),frames=[];let accumulator=0;
  view.frame(s.world,'me',0,1/fps,{alpha:0});
  for(let n=1;n<=fps;n++){
    accumulator+=1/fps;
    while(accumulator>=SIMULATION_STEP-1e-10){view.capture(s.world);s.tick({x:1},SIMULATION_STEP);accumulator-=SIMULATION_STEP;}
    frames.push(view.frame(s.world,'me',n*1000/fps,1/fps,{alpha:accumulator/SIMULATION_STEP}).me);
  }
  return frames;
}
for(const fps of [60,90,120])test(`continuous movement has no stop/go flicker at ${fps} Hz`,()=>{
  const frames=motion(fps),steps=frames.slice(10).map((p,i)=>p.x-frames[i+9].x);
  assert.ok(Math.max(...steps)-Math.min(...steps)<1e-6);
  assert.ok(Math.min(...steps)>0);assert.ok(frames.slice(Math.ceil(fps*.3)).every(p=>p.moveBlend>.9));
});
test('diagonal boundary noise does not alternate direction sprites',()=>{
  let facing=2;const frames=[];
  for(let n=0;n<120;n++){facing=stableFacing(Math.PI/4+(n%2?.02:-.02),facing);frames.push(facing);}
  assert.deepEqual(new Set(frames),new Set([2]));assert.equal(stableFacing(Math.PI/2,2),0);
});
test('walking poses stay gentle and snakes do not bounce vertically',()=>{
  for(let role=0;role<4;role++){
    const poses=Array.from({length:120},(_,n)=>gaitPose(role,n/120*2*Math.PI,1,n*1000/120));
    const changes=poses.slice(1).map((p,i)=>Math.abs(p.lift-poses[i].lift));
    assert.ok(Math.max(...changes)<.1);
    if(role===2)assert.ok(poses.every(p=>p.lift===0));
    if(role<2)assert.ok(Math.max(...poses.map(p=>p.lift))<=2.8);
  }
});
test('render interpolation never changes actual positions or mission state',()=>{
  const s=new SoloSession();s.start(90,0);const view=new MotionView();view.capture(s.world);s.tick({x:1},SIMULATION_STEP);
  const before=JSON.stringify(s.world);view.frame(s.world,'me',8,.008,{alpha:.5});assert.equal(JSON.stringify(s.world),before);
});
for(const [role,prey,count] of [[1,0,8],[2,1,7],[3,2,6]])test(`role ${role} receives ${count} prey and some begin within reach of exploration`,()=>{
  const s=new SoloSession();s.start();startRound(s.world,role);
  const animals=Object.values(s.world.players).filter(p=>p.bot&&p.role===prey);
  assert.equal(animals.length,count);assert.ok(animals.filter(p=>dist(p,s.me)<500).length>=3);
  for(const p of animals)for(const obstacle of OBSTACLES)assert.ok(dist(p,obstacle)>=obstacle.r+23-1e-7);
});
test('computer prey travel slower than the learner who hunts them',()=>{
  const s=new SoloSession();s.start();
  for(let role=1;role<4;role++){
    startRound(s.world,role);const prey=Object.values(s.world.players).find(p=>p.bot&&p.role===role-1);
    Object.assign(prey,{x:100,y:100,angle:0,effect:0});const before=prey.x;advanceMotion(prey,{x:1},.1);
    assert.ok(prey.x-before<ROLES[role].speed*.1);
  }
});
test('switching and restarting roles rebuilds the population instead of accumulating bots',()=>{
  const s=new SoloSession();s.start();
  for(let n=0;n<3;n++)for(let role=0;role<4;role++){
    startRound(s.world,role);const bots=Object.values(s.world.players).filter(p=>p.bot);
    assert.equal(bots.length,[12,13,15,17][role]);
  }
  s.start();assert.equal(Object.values(s.world.players).filter(p=>p.bot).length,12);
});
test('computer animals turn gradually and stay bounded during continuous play',()=>{
  const s=new SoloSession();s.start();startRound(s.world,3);
  for(let n=0;n<600;n++){
    const previous=new Map(Object.values(s.world.players).map(p=>[p.id,{angle:p.angle,respawn:p.respawn}]));
    s.tick({},SIMULATION_STEP);
    for(const p of Object.values(s.world.players))if(p.bot){
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
      assert.ok(p.x>=42&&p.x<=1758&&p.y>=45&&p.y<=1055);
      const old=previous.get(p.id);
      if(old&&!old.respawn&&!p.respawn){const turn=Math.abs(Math.atan2(Math.sin(p.angle-old.angle),Math.cos(p.angle-old.angle)));assert.ok(turn<=4.5*SIMULATION_STEP+1e-7);}
    }
  }
});
for(const role of [1,2,3])test(`role ${role} can finish its food mission with ordinary pursuit within 90 seconds`,()=>{
  const s=new SoloSession();s.start();startRound(s.world,role);
  let route=[],targetId='',repath=0,action=0;
  for(let tick=0;tick<5400&&!missionFor(s.me,90).complete;tick++){
    const foods=Object.values(s.world.players).filter(p=>p.bot&&canEat(s.me.role,p.role)&&p.respawn<=0&&!hideProtected(p));
    const target=foods.sort((a,b)=>dist(s.me,a)-dist(s.me,b))[0];let x=0,y=0;
    if(target){
      if(tick>=repath||target.id!==targetId||!route.length){route=findPath(s.me,target,role);targetId=target.id;repath=tick+24;}
      while(route.length&&dist(s.me,route[0])<20)route.shift();
      const goal=route[0]||target,d=dist(s.me,goal);if(d>2){x=(goal.x-s.me.x)/d;y=(goal.y-s.me.y)/d;}
      if(s.me.cool===0&&dist(s.me,target)<140)action++;
    }
    s.tick({x,y,action},SIMULATION_STEP);
  }
  assert.equal(missionFor(s.me,90).complete,true);
});
