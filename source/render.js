import {W,H,JUMP_DURATION,JUMP_HEIGHT,ROLES,REEDS,ROCKS,TREES,hideProtected,visibleTo,canEat,dist} from './engine.js';
import {MAP_MARGIN,MAP_WIDTH,MAP_HEIGHT,project,unproject,facingFrame} from './projection.js';
import {ASSET_FRAMES} from './asset-frames.js';
import {MotionView,gaitPose} from './motion-view.js';
const animals=new Image();animals.src='./assets/animals-pixel.png';
const props=new Image();props.src='./assets/forest-props-pixel.png';
export function drawOrganismImage(c,id,x,y,size){
  const role=['grasshopper','frog','snake','hawk'].indexOf(id),img=id==='rice'?props:animals;
  if((id!=='rice'&&role<0)||!img.complete||!img.naturalWidth)return false;
  const frame=ASSET_FRAMES[id==='rice'?'forest-props-pixel.png':'animals-pixel.png'].frames[id==='rice'?3:role*4],scale=size/Math.max(frame.w,frame.h);
  c.drawImage(img,frame.x,frame.y,frame.w,frame.h,x-frame.w*scale/2,y-frame.h*scale/2,frame.w*scale,frame.h*scale);return true;
}
const box=(c,x,y,w,h,r=12)=>{c.beginPath();c.roundRect(x,y,w,h,r);};
const DECOR=[];
for(let x=-30;x<W+90;x+=145){DECOR.push({x,y:-25});DECOR.push({x:x+50,y:H+80});}
for(let y=100;y<H;y+=140){DECOR.push({x:-35,y});DECOR.push({x:W+40,y:y+10});}
function sprite(c,img,cell,x,y,size){
  if(!img.complete||!img.naturalWidth)return false;
  const frame=ASSET_FRAMES[img===animals?'animals-pixel.png':'forest-props-pixel.png'].frames[cell],scale=size/Math.max(frame.w,frame.h);
  c.drawImage(img,frame.x,frame.y,frame.w,frame.h,x-frame.w*scale/2,y-frame.h*scale,frame.w*scale,frame.h*scale);return true;
}
export class Renderer{
  constructor(canvas,onMove){
    this.canvas=canvas;this.c=canvas.getContext('2d');this.positions={};this.motion=new MotionView();this.camera={x:MAP_WIDTH/2,y:MAP_HEIGHT/2};this.last=performance.now();
    this.terrain=document.createElement('canvas');this.terrain.width=MAP_WIDTH/4;this.terrain.height=MAP_HEIGHT/4;this.paintTerrain();
    this.resize=new ResizeObserver(()=>this.fit());this.resize.observe(canvas);this.fit();
    canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();if(!this.scale)return;const p=unproject(this.left+(e.clientX-r.left)/this.scale,this.top+(e.clientY-r.top)/this.scale);if(p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H)onMove?.(p.x,p.y);});
  }
  fit(){const r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.6);this.canvas.width=Math.max(1,Math.round(r.width*d));this.canvas.height=Math.max(1,Math.round(r.height*d));this.dpr=d;this.c.imageSmoothingEnabled=false;}
  paintTerrain(){
    const c=this.terrain.getContext('2d');c.scale(.25,.25);c.fillStyle='#91bd70';c.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);c.save();c.translate(MAP_MARGIN,MAP_MARGIN);
    c.fillStyle='#bddf92';box(c,0,0,W,H,36);c.fill();c.save();box(c,0,0,W,H,36);c.clip();
    for(let x=0;x<W;x+=64)for(let y=0;y<H;y+=64){c.fillStyle=(x/64+y/64)%2?'#ffffff08':'#4e9d4607';c.fillRect(x,y,64,64);}
    const path=(points,width)=>{c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle='#b8bb78';c.lineWidth=width+8;c.stroke();c.strokeStyle='#f1dfae';c.lineWidth=width;c.stroke();c.strokeStyle='#fff0c9';c.lineWidth=width-14;c.stroke();};
    path([[100,440],[490,440],[710,320],[1120,320],[1520,440],[1700,440]],86);
    path([[200,440],[200,940],[710,940],[1100,690],[1550,690],[1550,440]],80);
    path([[490,440],[490,690],[1100,690],[1100,320]],76);
    path([[1120,320],[1120,140],[1680,140],[1680,690],[1550,690]],66);
    // This shallow wetland is passable; there are no invisible water walls.
    c.fillStyle='#7bb8a4';c.beginPath();c.ellipse(245,810,168,104,0,0,7);c.fill();c.fillStyle='#a3dfd6';c.beginPath();c.ellipse(245,805,155,94,0,0,7);c.fill();
    c.strokeStyle='#e9fff0';c.lineWidth=3;for(let i=0;i<7;i++){const x=120+i*38,y=770+(i%3)*28;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+10,y+5,x+22,y);c.stroke();}
    c.fillStyle='#9d774d';box(c,165,691,72,239,4);c.fill();c.fillStyle='#dfb980';box(c,168,691,66,237,4);c.fill();c.strokeStyle='#bb8e58';c.lineWidth=3;for(let y=700;y<929;y+=18){c.beginPath();c.moveTo(168,y);c.lineTo(234,y);c.stroke();}
    for(const r of REEDS){c.fillStyle='#7bb462';box(c,r.x-r.r,r.y-r.r*.7,r.r*2,r.r*1.4,40);c.fill();c.fillStyle='#9fca78';box(c,r.x-r.r+7,r.y-r.r*.7+7,r.r*2-14,r.r*1.4-14,34);c.fill();}
    let seed=23;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<650;i++){const x=rand()*W,y=rand()*H;c.strokeStyle='#72ad5733';c.lineWidth=2;c.beginPath();c.moveTo(x-3,y);c.lineTo(x,y-5);c.lineTo(x+3,y);c.stroke();if(i%19===0){c.fillStyle=i%2?'#fff3c4':'#f5b9a4';c.beginPath();c.arc(x+7,y+2,3,0,7);c.fill();}}
    c.restore();c.strokeStyle='#e3efb8';c.lineWidth=5;box(c,0,0,W,H,36);c.stroke();c.restore();
  }
  prop(c,type,p,size,alpha=1){
    const v=project(p.x,p.y);c.save();c.globalAlpha=alpha;c.fillStyle='#416c4030';c.beginPath();c.ellipse(v.x,v.y,size*.29,size*.09,0,0,7);c.fill();
    if(!sprite(c,props,type,v.x,v.y,size)){c.fillStyle=['#5b994e','#9d9a9d','#74a64b','#d1bc58'][type];box(c,v.x-size*.3,v.y-size*.6,size*.6,size*.6,20);c.fill();}c.restore();
  }
  pawn(c,p,pos,me,now){
    const v=project(pos.x,pos.y),role=p.role,size=role===3?65:58,pose=gaitPose(role,pos.walk,pos.moveBlend||0,now,p.base);
    let lift=pose.lift;
    const jumpLift=role===0&&p.effect>0?Math.sin(Math.max(0,Math.min(1,1-pos.jump/JUMP_DURATION))*Math.PI)*JUMP_HEIGHT:0;
    if(jumpLift>0)lift=jumpLift;if(p.effect>0&&role===3)lift*=.3;
    c.save();if(p.hidden)c.globalAlpha=hideProtected(p)?.43:.8;
    const shadowScale=1-jumpLift/JUMP_HEIGHT*.4;
    c.fillStyle='#31563935';c.beginPath();c.ellipse(v.x,v.y,19*shadowScale,7*shadowScale,0,0,7);c.fill();
    if(p.id===me?.id){c.strokeStyle='#fffef1';c.lineWidth=3;c.beginPath();c.ellipse(v.x,v.y,25,10,0,0,7);c.stroke();}
    if(p.protect>0){c.strokeStyle='#fff5ab';c.lineWidth=3;c.setLineDash([5,4]);c.beginPath();c.ellipse(v.x,v.y-20,32,40,0,0,7);c.stroke();c.setLineDash([]);}
    if(hideProtected(p)){c.strokeStyle='#9de3d0';c.lineWidth=3;c.beginPath();c.ellipse(v.x,v.y-20,31,38,0,0,7);c.stroke();}
    if(p.effect>0&&role===1){const end=project(pos.x+Math.cos(p.angle)*130,pos.y+Math.sin(p.angle)*130,15);c.strokeStyle='#ef93a1';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(v.x,v.y-18);c.lineTo(end.x,end.y);c.stroke();}
    const pixels=this.scale*this.dpr,snapX=Math.round((v.x+pose.sway-this.left)*pixels)/pixels+this.left,snapY=Math.round((v.y-lift-this.top)*pixels)/pixels+this.top;
    c.save();c.translate(snapX,snapY);c.filter=p.skin===1?'brightness(1.08) saturate(1.13) hue-rotate(-10deg)':p.skin===2?'brightness(.96) hue-rotate(15deg)':'none';
    if(!sprite(c,animals,role*4+(pos.facing??facingFrame(p.angle)),0,0,size)){c.font='36px sans-serif';c.textAlign='center';c.fillText(ROLES[role].emoji,0,-6);}c.restore();
    const fs=Math.max(13,11/this.scale),label=p.bot?'숲 친구':p.label;c.font=`${p.id===me?.id?'bold ':''}${fs}px "Noto Sans KR",sans-serif`;c.textAlign='center';const tw=c.measureText(label).width;
    c.fillStyle=p.id===me?.id?'#326c52':'#fffef1f0';box(c,v.x-tw/2-6,v.y+9,tw+12,fs+7,6);c.fill();c.fillStyle=p.id===me?.id?'#fffef1':'#3b6346';c.fillText(label,v.x,v.y+fs+10);
    if(p.id===me?.id){c.font='bold 13px "Noto Sans KR",sans-serif';c.fillStyle='#24523c';c.fillText(p.hidden?(hideProtected(p)?'숨기 보호 중':'숨기 보호 끝'):`나 · ${ROLES[role].name}`,v.x,v.y-size-lift-9);}c.restore();
  }
  draw(world,myId,teacher=false,options={}){
    if(!world)return;const c=this.c,now=performance.now(),dt=Math.min((now-this.last)/1000,.1);this.last=now;
    const width=this.canvas.width/this.dpr,height=this.canvas.height/this.dpr;
    this.positions=this.motion.frame(world,myId,now,dt,options);
    const me=this.positions[myId]||world.players[myId];
    this.scale=teacher?Math.min(width/MAP_WIDTH,height/MAP_HEIGHT):Math.max(width/1180,height/790);
    const vw=width/this.scale,vh=height/this.scale,goal=me?project(me.x,me.y):{x:MAP_WIDTH/2,y:MAP_HEIGHT/2};
    if(teacher)this.camera={x:MAP_WIDTH/2,y:MAP_HEIGHT/2};else{this.camera.x+=(goal.x-this.camera.x)*(1-Math.exp(-dt*12));this.camera.y+=(goal.y-this.camera.y)*(1-Math.exp(-dt*12));}
    this.left=teacher?(MAP_WIDTH-vw)/2:Math.max(0,Math.min(MAP_WIDTH-vw,this.camera.x-vw/2));this.top=teacher?(MAP_HEIGHT-vh)/2:Math.max(0,Math.min(MAP_HEIGHT-vh,this.camera.y-vh/2-20));
    const pixels=this.scale*this.dpr;this.left=Math.round(this.left*pixels)/pixels;this.top=Math.round(this.top*pixels)/pixels;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#91bd70';c.fillRect(0,0,width,height);c.scale(this.scale,this.scale);c.translate(-this.left,-this.top);c.drawImage(this.terrain,0,0,MAP_WIDTH,MAP_HEIGHT);
    const objects=[];for(const p of [...DECOR,...TREES])objects.push({depth:p.y,kind:'tree',p});for(const p of ROCKS)objects.push({depth:p.y,kind:'rock',p});
    for(const r of REEDS)for(let i=0;i<7;i++){const a=i*Math.PI*2/6,rad=i===6?0:66,p={x:r.x+Math.cos(a)*rad,y:r.y+Math.sin(a)*rad*.65};objects.push({depth:p.y,kind:'reed',p});}
    for(const p of world.plants)objects.push({depth:p.y,kind:'rice',p});const all=Object.values(world.players).filter(p=>p.online);
    for(const source of all){const p=this.positions[source.id]||source;if(p.respawn>0||!teacher&&me&&!visibleTo(me,p))continue;const revealed=p.hidden&&!hideProtected(p);objects.push({depth:p.y+(p.role===3||p.role===0&&p.effect>0||revealed?10000:0),kind:'pawn',p,pos:p});}objects.sort((a,b)=>a.depth-b.depth);
    for(const o of objects){const v=project(o.p.x,o.p.y);if(v.x<this.left-170||v.x>this.left+vw+170||v.y<this.top-170||v.y>this.top+vh+170)continue;
      if(o.kind==='pawn')this.pawn(c,o.p,o.pos,me,now);
      if(o.kind==='tree'){const fade=me&&!teacher&&Math.abs(me.x-o.p.x)<70&&me.y<o.p.y+12&&me.y>o.p.y-125;this.prop(c,0,o.p,TREES.includes(o.p)?145:140,fade?.35:1);}
      if(o.kind==='rock')this.prop(c,1,o.p,o.p.r*2+22);
      if(o.kind==='reed')this.prop(c,2,o.p,100,me&&dist(me,o.p)<100?.55:1);
      if(o.kind==='rice')this.prop(c,3,o.p,43,o.p.ready>0?.22:1);
    }
    c.font='14px "Noto Sans KR",sans-serif';c.textAlign='center';c.fillStyle='#3f6a3a';for(const r of REEDS){const v=project(r.x,r.y);c.fillText('숨는 풀숲',v.x,v.y+83);}
    for(const e of world.events||[]){const age=world.t-e.at;if(age<0||age>1.2||e.type==='skill')continue;const v=project(e.x,e.y);c.globalAlpha=1-age/1.2;c.font='bold 19px "Noto Sans KR",sans-serif';c.textAlign='center';c.fillStyle='#fffdeb';c.strokeStyle='#436343';c.lineWidth=4;const txt=e.type==='rice'?'벼 → 메뚜기':`${ROLES[e.from].name} → ${ROLES[e.to].name}`;c.strokeText(txt,v.x,v.y-70-age*30);c.fillText(txt,v.x,v.y-70-age*30);c.globalAlpha=1;}
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    if(me&&!teacher){const danger=all.some(p=>canEat(p.role,me.role)&&p.respawn<=0&&visibleTo(me,p)&&dist(p,me)<230);if(danger){const g=c.createRadialGradient(width/2,height/2,Math.min(width,height)*.3,width/2,height/2,Math.max(width,height)*.6);g.addColorStop(0,'transparent');g.addColorStop(1,'#cc87525c');c.fillStyle=g;c.fillRect(0,0,width,height);}this.minimap(c,world,me,width,height);}
  }
  minimap(c,world,me,width,height){
    const mw=152,mh=108,mx=width-mw-14,my=height-mh-14;c.save();c.fillStyle='#fffdf0f5';box(c,mx,my,mw,mh,12);c.fill();const scale=Math.min((mw-20)/W,(mh-32)/H),ox=mx+(mw-W*scale)/2,oy=my+9,to=p=>({x:ox+p.x*scale,y:oy+p.y*scale});c.fillStyle='#c1da9e';box(c,ox,oy,W*scale,H*scale,4);c.fill();
    for(const r of REEDS){const p=to(r);c.fillStyle='#5a8b58';c.beginPath();c.arc(p.x,p.y,3,0,7);c.fill();}if(me.role===0){for(const f of world.plants){if(f.ready>0)continue;const p=to(f);c.fillStyle='#b18c3d';c.fillRect(p.x-1,p.y-1,2,2);}}else{for(const food of Object.values(world.players)){if(!food.online||food.respawn>0||!canEat(me.role,food.role)||!visibleTo(me,food))continue;const p=to(food);c.fillStyle='#d49a36';c.beginPath();c.arc(p.x,p.y,2.5,0,7);c.fill();}}const p=to(me);c.fillStyle='#285d49';c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,4,0,7);c.fill();c.stroke();c.font='11px "Noto Sans KR",sans-serif';c.fillStyle='#526c47';c.textAlign='center';c.fillText('나의 위치 · 먹이 장소',mx+mw/2,my+mh-9);c.restore();
  }
}
