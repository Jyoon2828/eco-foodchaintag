import {createWorld,unpackWorld} from './engine.js';

export const WORLD_INTERVAL_MS=250;
export const INPUT_KEEPALIVE_MS=400;
export const INPUT_MAX_AGE_MS=1200;
export const HOST_HEARTBEAT_MS=4000;
export const HOST_TIMEOUT_MS=12000;
const round=n=>Math.round((Number(n)||0)*10)/10;
const list=value=>Array.isArray(value)?value:Object.values(value||{});
const digits=value=>String(value||'').split('').filter(v=>/^[0-3]$/.test(v)).map(Number);

// Static names/layout are stored separately from frequently changing motion.
// All fields in one update remain atomic, including roster changes on joining.
export function packRealtimeWorld(world){
  const entries=Object.entries(world.players).sort(([a],[b])=>a.localeCompare(b));
  const indices=new Map(entries.map(([id],i)=>[id,i]));
  return {
    v:3,
    clock:[round(world.t),world.round,world.duration,world.phase,round(world.remaining),world.bots,world.serial],
    roster:entries.map(([id,p])=>[id,p.base,p.group,p.label,p.bot?1:0,p.skin??0]),
    motion:entries.map(([,p])=>[p.role,p.online?1:0,round(p.x),round(p.y),round(p.angle),p.score,p.caught,round(p.cool),round(p.effect),round(p.protect),round(p.respawn),round(p.eatWait),p.hidden?1:0,p.actionSeq,(p.learned||[]).join(''),(p.visited||[]).join('')].join(',')).join(';'),
    garden:world.plants.map(p=>[p.id,p.x,p.y]),
    ripeness:world.plants.map(p=>round(p.ready)).join(','),
    events:(world.events||[]).map(e=>[e.id,e.type==='skill'?0:e.type==='rice'?1:2,round(e.at),indices.get(e.hunter)??-1,indices.get(e.prey)??-1,e.from??-1,e.to??-1,e.role??-1,round(e.x),round(e.y)].join(',')).join(';')
  };
}

export function unpackRealtimeWorld(packet){
  if(packet.v!==3)return unpackWorld(packet);
  const c=list(packet.clock),world=createWorld(c[2],c[5]),roster=list(packet.roster),rows=String(packet.motion||'').split(';');
  Object.assign(world,{t:c[0]||0,round:c[1]||0,duration:c[2],phase:c[3]||'lobby',remaining:c[4]??c[2],bots:c[5]||0,serial:c[6]||0});
  roster.forEach((row,i)=>{
    const [id,base,group,label,bot,skin]=list(row),r=(rows[i]||'').split(',');
    world.players[id]={id,base,group,label,bot:!!bot,skin:skin??0,role:+r[0]||0,online:r[1]==='1',x:+r[2]||0,y:+r[3]||0,angle:+r[4]||0,score:+r[5]||0,caught:+r[6]||0,cool:+r[7]||0,effect:+r[8]||0,protect:+r[9]||0,respawn:+r[10]||0,eatWait:+r[11]||0,hidden:r[12]==='1',actionSeq:+r[13]||0,learned:digits(r[14]),visited:digits(r[15])};
  });
  const readiness=String(packet.ripeness||'').split(',');
  if(packet.garden)world.plants=list(packet.garden).map((row,i)=>{const [id,x,y]=list(row);return {id,x,y,ready:+readiness[i]||0};});
  world.events=String(packet.events||'').split(';').filter(Boolean).map(row=>{
    const r=row.split(',').map(Number),hunter=list(roster[r[3]])[0],e={id:r[0],at:r[2],hunter,x:r[8],y:r[9]};
    if(r[1]===0)return {...e,type:'skill',role:r[7]};
    if(r[1]===1)return {...e,type:'rice',from:r[5],to:r[6]};
    return {...e,type:'catch',prey:list(roster[r[4]])[0],from:r[5],to:r[6]};
  });
  return world;
}

export function worldPatch(previous,next){
  if(!previous)return next;
  const patch={};
  for(const key of new Set([...Object.keys(previous),...Object.keys(next)])){
    if(JSON.stringify(previous[key])!==JSON.stringify(next[key]))patch[key]=next[key]??null;
  }
  return Object.keys(patch).length?patch:null;
}

export function normalizeInput(input){
  const axis=n=>Math.round(Math.max(-1,Math.min(1,Number(n)||0))*100)/100;
  return {x:axis(input.x),y:axis(input.y),action:Math.max(0,Math.floor(Number(input.action)||0))};
}
export function inputDue(previous,input,epoch,now){
  if(!previous||previous.epoch!==epoch)return true;
  const changed=input.x!==previous.x||input.y!==previous.y||input.action!==previous.action;
  if(changed)return input.action!==previous.action||(input.x===0&&input.y===0)||now-previous.sentAt>=80;
  return Math.hypot(input.x,input.y)>.03&&now-previous.sentAt>=INPUT_KEEPALIVE_MS;
}
