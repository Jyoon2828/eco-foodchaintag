export const QUIZ_ORGANISMS={
  rice:{name:'벼',role:-1},grasshopper:{name:'메뚜기',role:0},
  frog:{name:'개구리',role:1},snake:{name:'뱀',role:2},hawk:{name:'매',role:3}
};
export const QUIZZES=[
  {question:'메뚜기가 벼를 먹었어요. 두 그림을 연결해 볼까요?',
    chain:['rice','grasshopper'],
    explanation:'벼에서 메뚜기 쪽으로 화살표를 놓아요. 벼는 먹히는 생물, 메뚜기는 먹는 생물이에요.'},
  {question:'개구리의 먹이와 천적을 하나의 먹이사슬로 연결해요.',
    chain:['grasshopper','frog','snake'],
    explanation:'개구리는 메뚜기를 먹고, 뱀에게 먹혀요. 먹기도 하고 먹히기도 하는 생물이에요.'},
  {question:'뱀의 먹이와 천적을 하나의 먹이사슬로 연결해요.',
    chain:['frog','snake','hawk'],
    explanation:'뱀은 개구리를 먹고, 매에게 먹혀요. 개구리 → 뱀 → 매로 이어져요.'},
  {question:'다섯 그림을 모두 이어 숲속 먹이사슬을 완성해요!',
    chain:['rice','grasshopper','frog','snake','hawk'],
    explanation:'벼 → 메뚜기 → 개구리 → 뱀 → 매. 화살표는 먹히는 생물에서 먹는 생물 쪽이에요.'}
];
export function quizForRole(role){return QUIZZES[role]||QUIZZES[0];}
export function isCorrect(role,order){
  const expected=quizForRole(role).chain;
  return Array.isArray(order)&&order.length===expected.length&&expected.every((id,i)=>order[i]===id);
}
export function evaluateChain(role,order){
  const quiz=quizForRole(role);
  if(!Array.isArray(order)||order.length!==quiz.chain.length){
    return {status:'incomplete',wrongAt:-1,message:`그림 ${quiz.chain.length}개를 모두 놓은 뒤 연결을 확인해 보세요.`};
  }
  if(isCorrect(role,order))return {status:'correct',wrongAt:-1,message:'잘 연결했어요! '+quiz.explanation};
  const wrongAt=order.findIndex((id,i)=>i<order.length-1&&!quiz.chain.some((food,k)=>food===id&&quiz.chain[k+1]===order[i+1]));
  const a=QUIZ_ORGANISMS[order[wrongAt]],b=QUIZ_ORGANISMS[order[wrongAt+1]];
  return {status:'wrong',wrongAt,message:a&&b?`${a.name} → ${b.name} 연결을 다시 생각해 보세요. 화살표는 먹히는 생물에서 먹는 생물 쪽이에요.`:'그림을 하나씩 골라 먹이관계를 다시 연결해 보세요.'};
}

export class ChainQuiz{
  constructor(role,random=Math.random){
    this.role=role;this.quiz=quizForRole(role);this.order=[];this.result=null;
    this.bank=[...this.quiz.chain];
    for(let i=this.bank.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[this.bank[i],this.bank[j]]=[this.bank[j],this.bank[i]];}
    // The bank is a set of choices rather than a prearranged solution.
    if(isCorrect(role,this.bank))this.bank.push(this.bank.shift());
  }
  get complete(){return this.order.length===this.quiz.chain.length;}
  get solved(){return this.result?.status==='correct';}
  add(id){
    if(this.solved||this.complete||!this.bank.includes(id)||this.order.includes(id))return false;
    this.order.push(id);this.result=null;return true;
  }
  removeFrom(index){
    if(this.solved||!Number.isInteger(index)||index<0||index>=this.order.length)return false;
    this.order=this.order.slice(0,index);this.result=null;return true;
  }
  undo(){return this.removeFrom(this.order.length-1);}
  clear(){if(this.solved)return false;this.order=[];this.result=null;return true;}
  check(){this.result=evaluateChain(this.role,this.order);return this.result;}
}
