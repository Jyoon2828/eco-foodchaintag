import {W,H,JUMP_DURATION,advanceMotion,dist,resolvePosition} from './engine.js';
import {facingFrame} from './projection.js';

const mix=(a,b,t)=>a+(b-a)*t;
const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const motionKeys=['x','y','angle','effect','cool'];

export function stableFacing(angle,previous){
  const x=Math.cos(angle),y=Math.sin(angle);
  if((previous===1&&x<0||previous===2&&x>=0)&&Math.abs(x)>.75*Math.abs(y))return previous;
  if((previous===0&&y>=0||previous===3&&y<0)&&Math.abs(y)>.75*Math.abs(x))return previous;
  return facingFrame(angle);
}
export function gaitPose(role,phase,blend,time,base=0){
  if(role===3)return {lift:22+Math.sin(time/650+base)*1.5,sway:0};
  if(role===2)return {lift:0,sway:Math.sin(phase)*.9*blend};
  return {lift:(1-Math.cos(phase))*(role===1?1.4:.65)*blend,sway:0};
}

// Presentation only: no catches, food, scores or database writes happen here.
export class MotionView{
  constructor(){this.states=new Map();this.world=null;this.tick=null;this.round=null;this.phase=null;}
  frame(world,myId,now,dt,{input={},predict=false,interval=.25}={}){
    const fresh=this.world!==world||this.tick!==world.t||this.phase!==world.phase;
    if(this.round!==world.round||world.t<this.tick)this.states.clear();
    this.round=world.round;
    const result={};
    for(const p of Object.values(world.players)){
      let state=this.states.get(p.id);
      const reset=!state||state.role!==p.role||state.respawn!==!!p.respawn||dist(state.latest,p)>240;
      if(reset){state={role:p.role,respawn:!!p.respawn,history:[],latest:{...p},walk:0,moveBlend:0,facing:undefined,last:{x:p.x,y:p.y},error:{x:0,y:0}};this.states.set(p.id,state);}
      if(fresh||reset){
        const sample={...p,at:now};state.history.push(sample);state.history=state.history.slice(-6);state.latest=sample;
        if(p.id===myId&&predict){
          const pending=state.pred&&state.pred.actionSeq>p.actionSeq&&now-state.pendingAt<650;
          if(!pending){
            const error=state.pred&&!reset?{x:state.last.x-p.x,y:state.last.y-p.y}:{x:0,y:0};
            state.error=Math.hypot(error.x,error.y)<140?error:{x:0,y:0};state.pred={...p};
          }
        }
      }
      let visual={...p};
      if(world.phase==='playing'&&!p.respawn){
        if(p.id===myId&&predict){
          state.pred||={...p};
          const seq=state.pred.actionSeq;advanceMotion(state.pred,input,Math.min(dt,.1));
          if(state.pred.actionSeq>seq)state.pendingAt=now;
          const decay=Math.exp(-dt*14);state.error.x*=decay;state.error.y*=decay;
          visual={...p,...Object.fromEntries(motionKeys.map(k=>[k,state.pred[k]])),x:state.pred.x+state.error.x,y:state.pred.y+state.error.y};
        }else{
          // A short buffer plus bounded extrapolation bridges 250 ms packets.
          visual={...p,...this.sample(state,now-Math.min(.15,interval*1.2)*1000)};
        }
      }else{state.pred=null;state.error={x:0,y:0};}
      visual.x=Math.max(42,Math.min(W-42,visual.x));visual.y=Math.max(45,Math.min(H-45,visual.y));
      const moved=reset?0:dist(state.last,visual),speed=moved/Math.max(dt,.001);
      const targetBlend=world.phase==='playing'?Math.min(1,speed/110):0;
      state.moveBlend=mix(state.moveBlend,targetBlend,1-Math.exp(-Math.max(0,dt)*14));
      state.walk+=moved*.025;state.facing=stableFacing(visual.angle,state.facing);
      result[p.id]={...visual,walk:state.walk,moving:speed,moveBlend:state.moveBlend,facing:state.facing,jump:visual.role===0?visual.effect:0};
      state.last={x:visual.x,y:visual.y};
    }
    for(const id of this.states.keys())if(!world.players[id])this.states.delete(id);
    this.world=world;this.tick=world.t;this.phase=world.phase;
    return result;
  }
  sample(state,time){
    const h=state.history,first=h[0],last=h.at(-1);
    if(time<=first.at)return {...first};
    for(let i=1;i<h.length;i++)if(time<=h[i].at){
      const a=h[i-1],b=h[i],t=(time-a.at)/Math.max(1,b.at-a.at),out={};
      for(const k of motionKeys)out[k]=k==='angle'?turn(a[k],b[k],t):mix(a[k],b[k],t);
      // Skills start at the new sample; interpolate their remaining time only
      // after both snapshots agree on the action, avoiding a false jump at rest.
      if(a.actionSeq!==b.actionSeq){
        const remaining=b.effect+(b.at-time)/1000;
        out.effect=b.role===0&&b.effect>0?(remaining<=JUMP_DURATION?remaining:0):(t<.5?a.effect:b.effect);
      }
      return out;
    }
    const previous=h.at(-2),extra=Math.min(120,Math.max(0,time-last.at)),out={...last};
    if(previous&&last.at>previous.at&&last.at-previous.at<600){
      const vx=(last.x-previous.x)/(last.at-previous.at),vy=(last.y-previous.y)/(last.at-previous.at);
      if(Math.hypot(vx,vy)<.65){out.x+=vx*extra;out.y+=vy*extra;}
      out.effect=Math.max(0,last.effect-extra/1000);out.cool=Math.max(0,last.cool-extra/1000);
      if(out.role!==3&&!(out.role===0&&out.effect>0))Object.assign(out,resolvePosition(out.x,out.y));
    }
    return out;
  }
}
