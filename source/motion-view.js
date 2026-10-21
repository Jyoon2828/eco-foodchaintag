import {dist,JUMP_DURATION} from './engine.js';
import {facingFrame} from './projection.js';

export const SIMULATION_STEP=1/60;
const mix=(a,b,t)=>a+(b-a)*t;
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
export class MotionView{
  constructor(){this.positions=new Map();this.previous=new Map();this.round=null;}
  capture(world){
    this.previous=new Map(Object.values(world.players).map(p=>[p.id,{x:p.x,y:p.y,angle:p.angle,effect:p.effect,role:p.role,respawn:p.respawn,actionSeq:p.actionSeq}]));
    this.round=world.round;
  }
  frame(world,myId,now,dt,{alpha=1}={}){
    const result={},blendTime=1-Math.exp(-Math.max(0,dt)*14);
    for(const p of Object.values(world.players)){
      const old=this.positions.get(p.id),previous=this.previous.get(p.id),visual={...p};
      const continuous=world.phase==='playing'&&this.round===world.round&&previous&&previous.role===p.role&&!p.respawn&&!previous.respawn&&dist(previous,p)<100;
      if(continuous){
        const t=Math.max(0,Math.min(1,alpha));visual.x=mix(previous.x,p.x,t);visual.y=mix(previous.y,p.y,t);
        if(p.role===0&&p.effect>0&&p.actionSeq!==previous.actionSeq)visual.effect=Math.min(JUMP_DURATION,p.effect+(1-t)*SIMULATION_STEP);
        else visual.effect=mix(previous.effect,p.effect,t);
      }
      const reset=!old||old.round!==world.round||old.role!==p.role||!!old.respawn!==!!p.respawn||dist(old,visual)>100;
      const moved=reset?0:dist(old,visual),speed=moved/Math.max(.001,dt),targetBlend=world.phase==='playing'?Math.min(1,speed/110):0;
      const moveBlend=reset?0:mix(old.moveBlend,targetBlend,blendTime),walk=(reset?0:old.walk)+moved*.025;
      const facing=stableFacing(p.angle,reset?undefined:old.facing);
      result[p.id]={...visual,walk,moving:speed,moveBlend,facing,jump:visual.role===0?visual.effect:0};
      this.positions.set(p.id,{x:visual.x,y:visual.y,round:world.round,role:p.role,respawn:p.respawn,walk,moveBlend,facing});
    }
    for(const id of this.positions.keys())if(!world.players[id])this.positions.delete(id);
    return result;
  }
}
