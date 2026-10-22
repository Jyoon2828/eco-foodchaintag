import {QUIZZES,QUIZ_ORGANISMS} from './quiz.js';

export const WEB_ORGANISMS={...QUIZ_ORGANISMS,mouse:{name:'생쥐'},sparrow:{name:'참새'}};
export const WEB_POSITIONS={rice:[80,280],grasshopper:[300,125],mouse:[300,435],frog:[520,125],sparrow:[520,435],snake:[740,125],hawk:[900,280]};
export const WEB_STAGES=['intro','connect','observe','reflect','complete'];
const chainToEdges=chain=>chain.slice(0,-1).map((food,i)=>[food,chain[i+1]]);
export const WEB_BASE_EDGES=chainToEdges(QUIZZES[3].chain);
// A small set of example relations, rather than a list of every possible diet.
export const WEB_EXTRA_EDGES=[['rice','mouse'],['mouse','snake'],['rice','sparrow'],['grasshopper','sparrow'],['sparrow','snake'],['sparrow','hawk']];
export const WEB_EDGES=[...WEB_BASE_EDGES,...WEB_EXTRA_EDGES];
export const WEB_PATHS=[QUIZZES[3].chain,['rice','mouse','snake','hawk'],['rice','grasshopper','sparrow','hawk'],['rice','sparrow','snake','hawk']];
export const webEdgeKey=(food,eater)=>food+'>'+eater;
export const webName=id=>WEB_ORGANISMS[id]?.name||'';
export const isWebEdge=(food,eater)=>WEB_EDGES.some(([a,b])=>a===food&&b===eater);
export const isBaseEdge=(food,eater)=>WEB_BASE_EDGES.some(([a,b])=>a===food&&b===eater);

export function webEdgeGeometry(food,eater){
  const [x1,y1]=WEB_POSITIONS[food],[x2,y2]=WEB_POSITIONS[eater],dx=x2-x1,dy=y2-y1;
  const offset=Math.min(58/Math.abs(dx||.001),70/Math.abs(dy||.001));
  const start=[x1+dx*offset,y1+dy*offset],end=[x2-dx*offset,y2-dy*offset];
  const c1=[start[0]+(end[0]-start[0])/3,start[1]+(end[1]-start[1])/3];
  const c2=[start[0]+(end[0]-start[0])*2/3,start[1]+(end[1]-start[1])*2/3];
  return {start,end,c1,c2,path:`M${start} C${c1} ${c2} ${end}`};
}
export class FoodWebActivity{
  constructor(){
    this.stage='intro';this.edges=WEB_BASE_EDGES.map(edge=>[...edge]);this.history=[];
    this.selected=null;this.inspected=null;this.highlightPath=null;this.buildChecked=false;
    this.removed=null;this.observed=false;this.alternatives=new Set();this.reflection='';
    this.feedback='';
  }
  get complete(){return WEB_EDGES.every(([food,eater])=>this.hasEdge(food,eater));}
  get remaining(){return WEB_EDGES.length-this.edges.length;}
  hasEdge(food,eater){return this.edges.some(([a,b])=>a===food&&b===eater);}
  begin(){if(this.stage!=='intro')return false;this.stage='connect';this.feedback='먹히는 생물을 먼저, 그것을 먹는 생물을 다음에 눌러요.';return true;}
  select(id){
    if(this.stage!=='connect'||!WEB_ORGANISMS[id])return 'ignored';
    if(this.selected===id){this.selected=null;this.feedback='선택을 취소했어요. 먹히는 생물부터 다시 눌러요.';return 'cancelled';}
    if(!this.selected){this.selected=id;this.feedback=`${webName(id)}에서 출발해요. 이것을 먹는 생물을 눌러요.`;return 'selected';}
    const food=this.selected;this.selected=null;
    if(this.hasEdge(food,id)){this.feedback='이미 이어진 관계예요. 한 생물을 여러 생물과 연결할 수도 있어요.';return 'exists';}
    if(!isWebEdge(food,id)){
      this.feedback=isWebEdge(id,food)?'화살표 방향을 바꿔 볼까요? 먹히는 생물 → 먹는 생물 순서예요.':'이 활동의 단서에는 없는 연결이에요. 단서 카드를 보고 관계를 찾아보세요.';
      return isWebEdge(id,food)?'reversed':'outside';
    }
    this.edges.push([food,id]);this.history.push([food,id]);this.buildChecked=false;
    this.feedback=`${webName(food)} → ${webName(id)} 연결을 더했어요. ${this.remaining?`단서의 관계 ${this.remaining}개를 더 찾아요.`:'이제 먹이그물 확인하기를 눌러요!'}`;
    return 'added';
  }
  remove(food,eater){
    if(this.stage!=='connect'||isBaseEdge(food,eater)||!this.hasEdge(food,eater))return false;
    this.edges=this.edges.filter(([a,b])=>a!==food||b!==eater);
    this.history=this.history.filter(([a,b])=>a!==food||b!==eater);
    this.selected=null;this.buildChecked=false;this.feedback='새로 만든 연결을 지웠어요. 다시 이어 볼 수 있어요.';return true;
  }
  undo(){const edge=this.history.at(-1);return edge?this.remove(...edge):false;}
  reset(){
    if(this.stage!=='connect')return false;
    this.edges=WEB_BASE_EDGES.map(edge=>[...edge]);this.history=[];this.selected=null;this.buildChecked=false;
    this.feedback='가져온 먹이사슬은 남기고 새로 만든 연결만 지웠어요.';return true;
  }
  check(){
    if(this.stage!=='connect')return false;
    this.selected=null;this.buildChecked=this.complete;
    this.feedback=this.complete?'먹이그물 완성! 한 생물에 여러 화살표가 이어졌어요. 다음 단계에서 남아 있는 먹이를 살펴봐요.':`단서의 관계가 ${this.remaining}개 남았어요. 생쥐와 참새의 단서를 다시 읽어 보세요.`;
    return this.buildChecked;
  }
  toggleFrog(){
    if(this.stage!=='observe')return false;
    this.removed=this.removed?null:'frog';this.inspected='snake';this.highlightPath=null;
    if(this.removed)this.observed=true;
    this.feedback=this.removed?'개구리와 이어진 관계만 흐리게 표시했어요. 뱀에게 남은 먹이 두 가지를 아래에서 찾아요.':'개구리가 다시 보여요. 가리기 전과 후를 비교해 보세요.';
    return true;
  }
  answerAlternative(id){
    if(this.stage!=='observe'||!this.observed||this.removed!=='frog')return false;
    if(this.hasEdge(id,'snake')&&id!=='frog'){
      this.alternatives.add(id);this.feedback=`${webName(id)} → 뱀 관계가 남아 있어요. ${this.alternatives.size===2?'두 가지 먹이를 모두 찾았어요!':'또 다른 먹이도 찾아볼까요?'}`;return true;
    }
    this.feedback='지금 보이는 먹이그물에서 뱀 쪽으로 오는 화살표를 따라가 보세요.';return false;
  }
  inspect(id){if(!WEB_ORGANISMS[id])return false;this.inspected=this.inspected===id?null:id;this.highlightPath=null;return true;}
  showPath(index){if(!this.complete||!Number.isInteger(index)||!WEB_PATHS[index])return false;this.highlightPath=this.highlightPath===index?null:index;this.inspected=null;return true;}
  setReflection(text){this.reflection=String(text).slice(0,180);}
  next(){
    if(this.stage==='connect'&&this.complete&&this.buildChecked){this.stage='observe';this.feedback='개구리 가려보기를 눌러 연결이 어떻게 달라지는지 살펴봐요.';}
    else if(this.stage==='observe'&&this.observed&&this.alternatives.size===2){this.stage='reflect';this.removed=null;this.inspected=null;this.highlightPath=null;this.feedback='';}
    else if(this.stage==='reflect'&&this.reflection.trim()){this.stage='complete';this.reflection=this.reflection.trim();this.feedback='';}
    else return false;
    return true;
  }
  neighbors(id){
    const active=this.edges.filter(([a,b])=>a!==this.removed&&b!==this.removed);
    return {food:active.filter(([,eater])=>eater===id).map(([food])=>food),eaters:active.filter(([food])=>food===id).map(([,eater])=>eater)};
  }
}
