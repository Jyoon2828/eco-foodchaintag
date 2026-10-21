export const W = 1800, H = 1100;
export const JUMP_DURATION=.75, JUMP_DISTANCE=330, JUMP_HEIGHT=96;
export const HIDE_DURATION=3, HIDE_RESET_TIME=1;
export const ROLES = [
  {name:'메뚜기',emoji:'🦗',color:'#749b32',food:'벼',enemy:'개구리',skill:'멀리 뛰기',speed:255,cd:4},
  {name:'개구리',emoji:'🐸',color:'#23856c',food:'메뚜기',enemy:'뱀',skill:'혀 뻗기',speed:235,cd:3},
  {name:'뱀',emoji:'🐍',color:'#b17b42',food:'개구리',enemy:'매',skill:'풀숲 숨기',speed:245,cd:5},
  {name:'매',emoji:'🦅',color:'#8260a7',food:'뱀',enemy:'이 놀이에서는 없음',skill:'빠르게 내려오기',speed:275,cd:5}
];
export const REEDS = [{x:320,y:250,r:125},{x:1420,y:270,r:130},{x:620,y:800,r:120},{x:1320,y:820,r:115}];
export const ROCKS = [{x:890,y:290,r:58},{x:1020,y:780,r:55},{x:420,y:560,r:46}];
export const TREES = [{x:600,y:280,r:38},{x:1250,y:530,r:40},{x:660,y:630,r:40},{x:1420,y:680,r:40},{x:250,y:500,r:36},{x:1540,y:170,r:40},{x:980,y:930,r:40}];
export const OBSTACLES=[...ROCKS.map(p=>({...p,kind:'rock'})),...TREES.map(p=>({...p,kind:'tree'}))];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const roleFor=(base,round)=>((base+round)%4+4)%4;
export const canEat=(predator,prey)=>predator>=1 && predator<=3 && predator===prey+1;
export const inReeds=p=>REEDS.some(r=>dist(r,p)<r.r);
export const inCover=p=>inReeds(p)||TREES.some(t=>dist(t,p)<t.r+65);
export const hideProtected=p=>!!p.hidden&&(p.hideTime||0)<HIDE_DURATION;
export function missionFor(p,duration=90){
  const role=p?.role??0,goal=Math.max(1,Math.ceil([5,3,2,2][role]*duration/90)),count=p?.fed||0,unit=role===0?'개':'마리';
  return {goal,count,unit,food:ROLES[role].food,complete:count>=goal,text:`${ROLES[role].food} ${goal}${unit} 이상 먹기`};
}
export function createWorld(duration=90,bots=2) {
  const plants=Array.from({length:24},(_,i)=>({id:i,x:180+(i%8)*205+(i%2)*30,y:170+Math.floor(i/8)*345,ready:0}));
  return {v:1,t:0,round:0,duration:clamp(duration,30,180),phase:'lobby',remaining:duration,bots:clamp(bots,0,4),players:{},plants,events:[],serial:0};
}
function spawn(p,world) {
  // Different safe starting positions. Respawns have a visible protection ring.
  const i=(p.base*11+world.serial*3+(p.bot?11:0))%28;
  p.x=120+(i%7)*255; p.y=130+Math.floor(i/7)*265;
  if(p.bot){p.x=Math.min(W-60,p.x+100);p.y=Math.min(H-60,p.y+95);}
  if(p.role!==3){const safe=resolvePosition(p.x,p.y);p.x=safe.x;p.y=safe.y;}
  p.angle=0;p.cool=0;p.effect=0;p.protect=3;p.respawn=0;p.hidden=false;p.hideTime=0;p.hideAway=0;p.eatWait=0;
}
export function addPlayer(world,id,info={},bot=false) {
  if(world.players[id]) {Object.assign(world.players[id],{online:true,group:info.group??world.players[id].group,label:info.label??world.players[id].label,skin:info.skin??world.players[id].skin??0});return world.players[id];}
  const humans=Object.values(world.players).filter(p=>!p.bot);
  const used=new Set(humans.map(p=>p.base));let base=0;while(used.has(base))base++;
  if(bot)base=info.base??0;
  const p={id,base,role:roleFor(base,world.round),group:info.group||1,label:info.label||(bot?'숲 친구':'탐험가'),skin:info.skin??0,bot,online:true,x:100,y:100,angle:0,score:0,fed:0,caught:0,cool:0,effect:0,protect:3,respawn:0,eatWait:0,hidden:false,hideTime:0,hideAway:0,actionSeq:0,learned:[],visited:[]};
  spawn(p,world);world.players[id]=p;return p;
}
export function syncMembers(world,members={}) {
  const entries=Object.entries(members).filter(([,m])=>m&&m.online).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)||a[0].localeCompare(b[0]));
  for(const p of Object.values(world.players))if(!p.bot)p.online=!!members[p.id]?.online;
  for(const [id,m]of entries.slice(0,36))addPlayer(world,id,{group:m.group,label:`${m.group}모둠 ${m.seat}번`,skin:m.skin??0});
}
export function ensureBots(world) {
  for(let r=0;r<4;r++)for(let j=0;j<world.bots;j++){
    const id=`bot_${r}_${j}`;if(!world.players[id])addPlayer(world,id,{base:r+4*j,group:0,label:`숲 친구`},true);
  }
}
export function startRound(world,round=0) {
  world.round=clamp(round,0,3);world.remaining=world.duration;world.phase='playing';
  ensureBots(world);
  for(const p of Object.values(world.players)){
    p.role=roleFor(p.base,world.round);p.fed=0;p.visited=Array.from(new Set([...p.visited,p.role]));spawn(p,world);
  }
  return world;
}
function event(world,e){world.events.push({...e,id:++world.serial,at:Math.round(world.t*10)/10});world.events=world.events.slice(-35);}
function learn(p,link){if(!p.learned.includes(link))p.learned.push(link);}
function catchPrey(world,p,q){
  if(!canEat(p.role,q.role)||p.eatWait>0||q.protect>0||hideProtected(q)||q.respawn>0||p.respawn>0)return false;
  const link=p.role;learn(p,link);learn(q,link);p.score++;p.fed=(p.fed||0)+1;q.caught++;q.respawn=2.5;q.hidden=false;p.eatWait=1.2;
  event(world,{type:'catch',from:q.role,to:p.role,hunter:p.id,prey:q.id,x:q.x,y:q.y});return true;
}
export function visibleTo(viewer,target){
  if(viewer?.id===target.id||!viewer)return true;
  if(target.hidden){if(!hideProtected(target))return true;if(dist(viewer,target)>=110)return false;}
  return hasLineOfSight(viewer,target);
}
export function hasLineOfSight(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1)return true;
  return !OBSTACLES.some(o=>{const t=((o.x-a.x)*dx+(o.y-a.y)*dy)/l2;if(t<=.04||t>=.96)return false;return Math.hypot(a.x+t*dx-o.x,a.y+t*dy-o.y)<o.r+5;});
}
export function resolvePosition(x,y){
  for(let pass=0;pass<2;pass++)for(const o of OBSTACLES){const d=Math.hypot(x-o.x,y-o.y),min=o.r+23;if(d<min){const a=d<.001?0:Math.atan2(y-o.y,x-o.x);x=o.x+Math.cos(a)*min;y=o.y+Math.sin(a)*min;}}
  return {x:clamp(x,42,W-42),y:clamp(y,45,H-45)};
}
function aiInput(world,p){
  const all=Object.values(world.players).filter(q=>q.online&&q.respawn<=0&&q.id!==p.id);
  const dangers=all.filter(q=>canEat(q.role,p.role)&&visibleTo(p,q));
  const danger=dangers.sort((a,b)=>dist(p,a)-dist(p,b))[0];let dx=0,dy=0,act=false;
  if(danger&&dist(p,danger)<250){dx=p.x-danger.x;dy=p.y-danger.y;act=p.role===0||p.role===2;}
  else{
    const foods=p.role===0?world.plants.filter(q=>q.ready<=0):all.filter(q=>canEat(p.role,q.role)&&q.protect<=0&&visibleTo(p,q));
    const target=foods.sort((a,b)=>dist(p,a)-dist(p,b))[0];
    if(target){dx=target.x-p.x;dy=target.y-p.y;act=dist(p,target)<170&&p.role>0;}
    else {dx=Math.cos(world.t*.3+p.base);dy=Math.sin(world.t*.4+p.base);}
  }
  let len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  if(p.role!==3){
    const o=OBSTACLES.find(o=>Math.hypot(p.x+dx*85-o.x,p.y+dy*85-o.y)<o.r+36);
    if(o){const d=Math.hypot(p.x-o.x,p.y-o.y)||1,nx=(p.x-o.x)/d,ny=(p.y-o.y)/d;let tx=-ny,ty=nx;if(tx*dx+ty*dy<0){tx=-tx;ty=-ty;}dx=tx+nx*.35;dy=ty+ny*.35;}
  }
  len=Math.hypot(dx,dy)||1;return {x:dx/len,y:dy/len,action:act&&p.cool<=0?p.actionSeq+1:p.actionSeq};
}
export function findPath(start,target,role=0){
  const goal=role===3?{x:clamp(target.x,42,W-42),y:clamp(target.y,45,H-45)}:resolvePosition(target.x,target.y);
  if(role===3)return [goal];
  const size=60,cols=Math.ceil(W/size),rows=Math.ceil(H/size),point=i=>({x:(i%cols+.5)*size,y:(Math.floor(i/cols)+.5)*size});
  const open=i=>{const p=point(i);return p.x>=42&&p.x<=W-42&&p.y>=45&&p.y<=H-45&&!OBSTACLES.some(o=>dist(o,p)<o.r+28);};
  const nearest=p=>{let best=-1,d=Infinity;for(let i=0;i<cols*rows;i++){if(!open(i))continue;const dd=dist(p,point(i));if(dd<d){best=i;d=dd;}}return best;};
  const a=nearest(start),b=nearest(goal);if(a<0||b<0)return [];
  const frontier=[a],from=new Map([[a,null]]);
  for(let head=0;head<frontier.length&&!from.has(b);head++){
    const n=frontier[head],x=n%cols,y=Math.floor(n/cols);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*cols+xx;if(xx<0||xx>=cols||yy<0||yy>=rows||from.has(k)||!open(k))continue;from.set(k,n);frontier.push(k);}
  }
  if(!from.has(b))return [];
  const path=[];for(let k=b;k!==null;k=from.get(k))path.push(point(k));path.reverse();
  // Include the first safe cell when the starting point is near an obstacle.
  if(path.length&&dist(start,path[0])<20)path.shift();
  if(!OBSTACLES.some(o=>dist(goal,o)<o.r+25))path.push(goal);
  return path;
}
// Shared movement keeps local presentation and the authoritative host consistent.
// It changes only motion/skill state; scoring and catches stay on the host.
export function advanceMotion(p,input={},dt=.05){
  dt=clamp(Number(dt)||0,0,.12);
  let jumpTime=p.role===0?p.effect:0;
  p.cool=Math.max(0,p.cool-dt);p.effect=Math.max(0,p.effect-dt);
  let dx=clamp(Number(input.x)||0,-1,1),dy=clamp(Number(input.y)||0,-1,1);
  const norm=Math.max(1,Math.hypot(dx,dy));dx/=norm;dy/=norm;
  if(jumpTime<=0&&Math.hypot(dx,dy)>.03)p.angle=Math.atan2(dy,dx);
  let skillStarted=false;
  if(Number(input.action)>p.actionSeq){
    p.actionSeq=Number(input.action);
    if(p.cool===0){p.cool=ROLES[p.role].cd;p.effect=p.role===0?JUMP_DURATION:p.role===2?3:p.role===1?.3:.65;if(p.role===0)jumpTime=JUMP_DURATION;skillStarted=true;}
  }
  let speed=ROLES[p.role].speed;
  if(p.effect>0){if(p.role===3)speed*=1.8;if(p.role===2)speed*=.55;}
  // Integrate the last partial frame, including automatic forward travel in a jump.
  const jumping=jumpTime>0,travel=jumping?JUMP_DISTANCE/JUMP_DURATION*Math.min(dt,jumpTime):speed*dt;
  let nx=clamp(p.x+(jumping?Math.cos(p.angle):dx)*travel,42,W-42),ny=clamp(p.y+(jumping?Math.sin(p.angle):dy)*travel,45,H-45);
  if(jumping)p.effect=jumpTime-dt>1e-8?jumpTime-dt:0;
  const airborne=p.role===0&&p.effect>0;
  if(p.role!==3&&!airborne){const safe=resolvePosition(nx,ny);nx=safe.x;ny=safe.y;}
  p.x=nx;p.y=ny;
  return {dx,dy,airborne,skillStarted};
}
export function advanceHiding(p,motion,dt){
  const cover=inCover(p),skill=p.role===2&&p.effect>0;
  p.hidden=!motion.airborne&&p.role!==3&&(cover&&Math.hypot(motion.dx,motion.dy)<.2||skill);
  if(p.hidden){
    const elapsed=(p.hideTime||0)+dt;
    p.hideTime=elapsed>=HIDE_DURATION-1e-8?HIDE_DURATION:elapsed;p.hideAway=0;
  }else if(!cover&&!skill){
    p.hideAway=Math.min(HIDE_RESET_TIME,(p.hideAway||0)+dt);
    if(p.hideAway>=HIDE_RESET_TIME-1e-8)p.hideTime=0;
  }else p.hideAway=0;
}
export function step(world,inputs={},dt=.05){
  if(world.phase!=='playing')return;
  dt=clamp(Number(dt)||0,0,.12);world.t+=dt;world.remaining=Math.max(0,world.remaining-dt);
  if(world.remaining<=0){world.phase='between';return;}
  const all=Object.values(world.players).filter(p=>p.online);
  for(const f of world.plants)f.ready=Math.max(0,f.ready-dt);
  for(const p of all){
    p.protect=Math.max(0,p.protect-dt);p.eatWait=Math.max(0,p.eatWait-dt);
    if(p.respawn>0){p.respawn=Math.max(0,p.respawn-dt);if(p.respawn===0)spawn(p,world);continue;}
    const input=p.bot?aiInput(world,p):(inputs[p.id]||{}),takeoff={x:p.x,y:p.y};
    const motion=advanceMotion(p,input,dt);
    if(motion.skillStarted)event(world,{type:'skill',hunter:p.id,role:p.role,...takeoff});
    advanceHiding(p,motion,dt);
    if(p.role===0&&!motion.airborne&&p.eatWait===0){
      const f=world.plants.find(q=>q.ready<=0&&dist(p,q)<47);
      if(f){f.ready=7;p.score++;p.fed=(p.fed||0)+1;p.eatWait=.65;learn(p,0);event(world,{type:'rice',hunter:p.id,from:-1,to:0,x:f.x,y:f.y});}
    }
  }
  // One authoritative host resolves collisions once. A prey cannot be caught twice.
  for(const p of all){
    if(p.role===0||p.respawn>0||p.eatWait>0)continue;
    const reach=p.role===1&&p.effect>0?145:52;
    for(const q of all){
      if(q.id===p.id||!canEat(p.role,q.role)||q.protect>0||hideProtected(q)||q.respawn>0||!visibleTo(p,q)||q.role===0&&q.effect>0)continue;
      const d=dist(p,q),angle=Math.atan2(q.y-p.y,q.x-p.x),dot=Math.cos(angle-p.angle);
      if(d<reach&&(d<52||dot>.45)){if(catchPrey(world,p,q))break;}
    }
  }
}
export function snapshot(world){
  return JSON.parse(JSON.stringify(world, (k,v)=>typeof v==='number'?Math.round(v*100)/100:v));
}
const PLAYER_FIELDS=['base','role','group','label','bot','online','x','y','angle','score','caught','cool','effect','protect','respawn','eatWait','hidden','actionSeq'];
export function packWorld(world){
  const packet={...world,v:2,players:{}};
  for(const [id,p]of Object.entries(world.players))packet.players[id]=[...PLAYER_FIELDS.map(k=>typeof p[k]==='number'?Math.round(p[k]*10)/10:p[k]),(p.learned||[]).join(','),(p.visited||[]).join(','),p.skin??0,p.hideTime||0,p.hideAway||0,p.fed||0];
  return snapshot(packet);
}
export function unpackWorld(packet){
  const world={...packet,players:{},events:packet.events||[],plants:packet.plants||[]};
  for(const [id,p]of Object.entries(packet.players||{})){
    if(packet.v===2){const row={id};PLAYER_FIELDS.forEach((k,i)=>row[k]=p[i]);row.learned=p[18]?p[18].split(',').map(Number):[];row.visited=p[19]?p[19].split(',').map(Number):[];row.skin=p[20]??0;row.hideTime=p[21]||0;row.hideAway=p[22]||0;row.fed=p[23]||0;world.players[id]=row;}
    else world.players[id]={...p,id,learned:p.learned||[],visited:p.visited||[],hideTime:p.hideTime||0,hideAway:p.hideAway||0,fed:p.fed||0};
  }
  world.v=1;return world;
}
export function groupSummary(world){
  return Array.from({length:6},(_,i)=>{
    const players=Object.values(world.players).filter(p=>!p.bot&&p.group===i+1);
    return {group:i+1,players:players.length,score:players.reduce((s,p)=>s+p.score,0),missions:players.filter(p=>missionFor(p,world.duration).complete).length,links:Array.from(new Set(players.flatMap(p=>p.learned))).sort()};
  });
}
