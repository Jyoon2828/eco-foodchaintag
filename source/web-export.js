import {WEB_ORGANISMS,WEB_POSITIONS,webName,webEdgeGeometry,isBaseEdge} from './food-web.js';
import {drawWebPicture} from './web-art.js';

function reportBox(c,x,y,width,height,radius,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,width,height,radius);c.fill();}
function reportWrap(c,text,width){
  const lines=[];let line='';
  for(const char of text){
    if(char==='\n'){lines.push(line);line='';continue;}
    if(line&&c.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;
  }
  if(line)lines.push(line);return lines;
}
export function drawFoodWebReport(canvas,activity){
  canvas.width=1600;canvas.height=1420;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  c.fillStyle='#fffdf3';c.fillRect(0,0,1600,1420);
  c.fillStyle='#78955e';c.font='bold 22px system-ui, sans-serif';c.fillText('4학년 과학 · 나의 먹이그물 탐험',64,62);
  c.fillStyle='#345a42';c.font='bold 46px system-ui, sans-serif';c.fillText('먹이사슬들이 만나 먹이그물이 되었어요',64,128);
  c.font='24px system-ui, sans-serif';c.fillText('7종류 생물 · 10개 먹이관계    |    먹히는 생물 → 먹는 생물',64,175);
  reportBox(c,54,205,1492,845,24,'#edf4e4');
  c.save();c.translate(64,220);c.scale(1.472,1.472);
  for(const [food,eater] of activity.edges){
    const {start,end,c1,c2}=webEdgeGeometry(food,eater),color=isBaseEdge(food,eater)?'#5e8858':'#be8437';
    c.strokeStyle=color;c.fillStyle=color;c.lineWidth=3;
    c.beginPath();c.moveTo(...start);c.bezierCurveTo(...c1,...c2,...end);c.stroke();
    const angle=Math.atan2(end[1]-c2[1],end[0]-c2[0]);
    c.beginPath();c.moveTo(...end);c.lineTo(end[0]-12*Math.cos(angle-.48),end[1]-12*Math.sin(angle-.48));c.lineTo(end[0]-12*Math.cos(angle+.48),end[1]-12*Math.sin(angle+.48));c.closePath();c.fill();
  }
  for(const id of Object.keys(WEB_ORGANISMS)){
    const [x,y]=WEB_POSITIONS[id];reportBox(c,x-50,y-62,100,124,12,'#fffef8');
    c.strokeStyle='#bfd1ac';c.lineWidth=1.5;c.beginPath();c.roundRect(x-50,y-62,100,124,12);c.stroke();
    if(!drawWebPicture(c,id,x,y-10,80))throw new Error('그림을 불러오는 중이에요. 잠시 뒤 다시 저장해 주세요.');
    c.fillStyle='#345a42';c.font='bold 17px system-ui, sans-serif';c.textAlign='center';c.fillText(webName(id),x,y+47);
  }
  c.restore();c.textAlign='left';
  c.fillStyle='#7b8d6c';c.font='19px system-ui, sans-serif';c.fillText('초록 화살표: 가져온 먹이사슬     갈색 화살표: 새로 더한 먹이관계',82,1020);
  c.fillStyle='#477956';c.font='bold 25px system-ui, sans-serif';c.fillText('내가 찾은 근거',64,1096);
  c.fillStyle='#526948';c.font='25px system-ui, sans-serif';c.fillText('개구리를 가려도 생쥐 → 뱀, 참새 → 뱀 관계가 남아 있었어요.',64,1137);
  c.fillStyle='#477956';c.font='bold 25px system-ui, sans-serif';c.fillText('나의 생각',64,1190);
  c.fillStyle='#345a42';c.font='26px system-ui, sans-serif';
  const lines=reportWrap(c,activity.reflection.replace(/\s+/g,' ').trim(),1465);
  lines.forEach((line,i)=>c.fillText(line,64,1232+i*35));
  c.fillStyle='#839478';c.font='18px system-ui, sans-serif';
  c.fillText('대표 먹이관계를 단순화한 학습 모형이에요. 실제 먹이는 생물의 종류와 계절 등에 따라 달라질 수 있어요.',64,1384);
  return canvas;
}
export function downloadFoodWebReport(activity){
  if(activity.stage!=='complete')throw new Error('활동과 생각 정리를 마친 뒤 저장할 수 있어요.');
  const canvas=document.createElement('canvas');drawFoodWebReport(canvas,activity);
  const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='나의_먹이그물_탐험.png';
  document.body.appendChild(link);link.click();link.remove();
}
