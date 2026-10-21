import test from 'node:test';
import assert from 'node:assert/strict';
import {W,H,JUMP_DURATION,JUMP_DISTANCE,OBSTACLES,createWorld,addPlayer,startRound,step,dist} from '../engine.js';
import {packRealtimeWorld,unpackRealtimeWorld} from '../sync.js';

function arena(x=100,y=100){
  const world=createWorld(30,0);
  addPlayer(world,'me');startRound(world);
  const player=world.players.me;Object.assign(player,{x,y,protect:0});
  return {world,player};
}
function finish(world,dt=.05){for(let n=0;n<100&&world.players.me.effect>0;n++)step(world,{},dt);assert.equal(world.players.me.effect,0);}
function safelyLanded(p){
  assert.ok(p.x>=42&&p.x<=W-42&&p.y>=45&&p.y<=H-45);
  for(const obstacle of OBSTACLES)assert.ok(dist(p,obstacle)>=obstacle.r+23-1e-7,'landed inside an obstacle');
}

for(const [name,x,y,dx,dy,obstacle] of [
  ['tree',600,190,0,1,{x:600,y:280,r:38}],
  ['rock',780,290,1,0,{x:890,y:290,r:58}]
])test(`jump crosses a ${name} that blocks walking`,()=>{
  const walking=arena(x,y),jumping=arena(x,y);
  for(let n=0;n<15;n++){
    step(walking.world,{me:{x:dx,y:dy}},.05);
    step(jumping.world,{me:{x:dx,y:dy,action:1}},.05);
    if(n===3){assert.ok(dist(jumping.player,obstacle)<obstacle.r);assert.ok(jumping.player.effect>0);}
  }
  assert.ok((walking.player.x-obstacle.x)*dx+(walking.player.y-obstacle.y)*dy<0);
  assert.ok((jumping.player.x-obstacle.x)*dx+(jumping.player.y-obstacle.y)*dy>obstacle.r+23);
  assert.ok(Math.abs(dist(jumping.player,{x,y})-JUMP_DISTANCE)<1e-7);
  assert.equal(jumping.player.effect,0);safelyLanded(jumping.player);
});

test('jump continues in the last facing direction after controls are released',()=>{
  const {world,player}=arena();player.angle=Math.PI/2;
  step(world,{me:{action:1}},.05);finish(world);
  assert.ok(Math.abs(player.x-100)<1e-7);
  assert.ok(Math.abs(player.y-100-JUMP_DISTANCE)<1e-7);
});

test('reversing controls and pressing jump again cannot redirect or restart a flight',()=>{
  const {world,player}=arena();step(world,{me:{x:1,action:1}},.05);
  for(let n=0;n<14;n++)step(world,{me:{x:-1,action:n+2}},.05);
  assert.equal(player.effect,0);assert.equal(player.angle,0);
  assert.ok(Math.abs(player.x-100-JUMP_DISTANCE)<1e-7);
  assert.ok(player.cool>3);assert.equal(world.events.filter(e=>e.type==='skill').length,1);
});

test('landing inside a rock moves the player to its safe edge',()=>{
  const {world,player}=arena(560,290);
  step(world,{me:{x:1,action:1}},.05);finish(world);
  assert.ok(player.x>890);safelyLanded(player);
  step(world,{me:{x:-1}},.05);safelyLanded(player);
});

test('jump stays inside every map edge',()=>{
  for(const [x,y,dx,dy] of [[W-60,100,1,0],[60,100,-1,0],[100,H-60,0,1],[100,60,0,-1]]){
    const {world,player}=arena(x,y);
    step(world,{me:{x:dx,y:dy,action:1}},.05);finish(world);safelyLanded(player);
  }
});

test('jump distance is stable with a final partial simulation frame',()=>{
  for(const dt of [.02,.05,.07,.12]){
    const {world,player}=arena();step(world,{me:{x:1,action:1}},dt);finish(world,dt);
    assert.ok(Math.abs(player.x-100-JUMP_DISTANCE)<1e-7,`distance changed at dt=${dt}`);
  }
});

test('airborne grasshopper cannot hide in reeds or eat rice until landing',()=>{
  const {world,player}=arena(180,170),rice=world.plants[0];
  step(world,{me:{x:1,action:1}},.05);
  assert.equal(player.score,0);assert.equal(rice.ready,0);
  player.x=320;player.y=250;
  step(world,{},.05);assert.equal(player.hidden,false);
  finish(world);player.x=rice.x;player.y=rice.y;step(world,{},.05);
  assert.equal(player.score,1);
});

test('an existing realtime packet resumes a jump within its current timer precision',()=>{
  const {world}=arena(780,290);step(world,{me:{x:1,action:1}},.1);
  const packet=packRealtimeWorld(world),restored=unpackRealtimeWorld(packet);
  assert.ok(Math.abs(restored.players.me.effect-(JUMP_DURATION-.1))<=.05+1e-7);
  finish(world);finish(restored);
  assert.ok(Math.abs(world.players.me.x-restored.players.me.x)<=JUMP_DISTANCE/JUMP_DURATION*.05+1e-7);
  safelyLanded(restored.players.me);
});
