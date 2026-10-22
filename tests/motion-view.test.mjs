import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionView} from '../motion-view.js';
import {W,createWorld,addPlayer,startRound,step,dist} from '../engine.js';

function scene(){const world=createWorld(90,0),p=addPlayer(world,'me');startRound(world);Object.assign(p,{x:100,y:100,protect:0});return {world,p};}
test('local movement responds before a network snapshot while authoritative positions stay untouched',()=>{
  const {world,p}=scene(),view=new MotionView();
  const result=view.frame(world,'me',0,1/60,{predict:true,input:{x:1}});
  assert.ok(result.me.x>100);assert.equal(p.x,100);assert.equal(p.score,0);
  for(let n=1;n<=6;n++)view.frame(world,'me',n*1000/60,1/60,{predict:true,input:{x:1}});
  const stopped=view.frame(world,'me',120,1/60,{predict:true,input:{}});
  const again=view.frame(world,'me',137,1/60,{predict:true,input:{}});
  assert.equal(stopped.me.x,again.me.x);
});
test('local jump prediction does not award food or catches',()=>{
  const {world,p}=scene(),view=new MotionView();
  const result=view.frame(world,'me',0,1/60,{predict:true,input:{x:1,action:1}});
  assert.ok(result.me.effect>0);assert.ok(result.me.x>100);
  assert.equal(p.effect,0);assert.equal(p.fed,0);assert.equal(world.events.length,0);
});
test('local travel stays consistent across common display frame rates',()=>{
  for(const fps of [20,30,60,120]){
    const {world}=scene(),view=new MotionView();let visual;
    for(let n=0;n<fps/2;n++)visual=view.frame(world,'me',n*1000/fps,1/fps,{predict:true,input:{x:1}}).me;
    assert.ok(Math.abs(visual.x-100-255*.5)<1e-6,`travel changed at ${fps} FPS`);
  }
});
test('remote characters move through intermediate positions between four-Hz packets',()=>{
  const {world,p}=scene(),view=new MotionView();view.frame(world,null,0,1/60);
  p.x=163.75;world.t=.25;
  const first=view.frame(world,null,250,1/60).me.x;
  const next=view.frame(world,null,266,1/60).me.x;
  assert.ok(first>100&&first<163.75);assert.ok(next>first&&next<163.75);
});
test('prediction reconciles with the host and resets on respawn and role changes',()=>{
  const {world,p}=scene(),view=new MotionView();
  for(let n=0;n<10;n++)view.frame(world,'me',n*16,1/60,{predict:true,input:{x:1}});
  p.respawn=2.5;p.x=300;world.t=.25;
  assert.equal(view.frame(world,'me',250,1/60,{predict:true,input:{x:1}}).me.x,300);
  startRound(world,1);
  const result=view.frame(world,'me',300,1/60,{predict:true});
  assert.equal(result.me.role,1);assert.ok(dist(result.me,p)<1);
});
test('presentation does not extrapolate forever during a stalled connection',()=>{
  const {world,p}=scene(),view=new MotionView();view.frame(world,null,0,1/60);
  p.x=163.75;world.t=.25;view.frame(world,null,250,1/60);
  const stalled=view.frame(world,null,2000,1/60).me;
  assert.ok(stalled.x<=163.75+255*.12+1e-7);
  assert.equal(view.frame(world,null,5000,1/60).me.x,stalled.x);
});
test('paused worlds stay still and hawk extrapolation respects map boundaries',()=>{
  const {world,p}=scene(),view=new MotionView();p.role=3;p.x=W-60;view.frame(world,null,0,1/60);
  p.x=W-43;world.t=.25;view.frame(world,null,250,1/60);
  assert.ok(view.frame(world,null,500,1/60).me.x<=W-42);
  world.phase='paused';const a=view.frame(world,'me',600,1/60,{predict:true,input:{x:1}}).me;
  const b=view.frame(world,'me',900,1/60,{predict:true,input:{x:1}}).me;assert.equal(a.x,b.x);
});
test('jumping over a tree uses the same collision rules in prediction and host simulation',()=>{
  const {world,p}=scene(),view=new MotionView();Object.assign(p,{x:600,y:190});
  for(let n=0;n<15;n++){
    const visual=view.frame(world,'me',n*50,.05,{predict:true,input:{y:1,action:1}}).me;
    step(world,{me:{y:1,action:1}},.05);
    assert.ok(dist(visual,p)<1e-6);
  }
  assert.ok(p.y>400);
});

test('remote walking blends stay continuous between packets at common screen rates',()=>{
  for(const fps of [60,90,120]){
    const {world,p}=scene(),view=new MotionView();let tick=-1,previous;
    for(let n=0;n<fps*2;n++){
      const seconds=n/fps,next=Math.floor((seconds+1e-8)*4);
      if(next!==tick){tick=next;world.t=next*.25;p.x=100+80*next*.25;}
      const current=view.frame(world,null,seconds*1000,1/fps).me;
      if(seconds>.6){assert.ok(current.moveBlend>.6,`walking flicker at ${fps} Hz`);assert.ok(current.x>=previous.x);assert.ok(current.x-previous.x<4);}
      previous=current;
    }
  }
});
