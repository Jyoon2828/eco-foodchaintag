import {QUIZ_ORGANISMS} from './quiz.js';

export function organismPicture(id){
  const organism=QUIZ_ORGANISMS[id];
  return `<i class="${organism.role<0?'rice-picture':'animal a'+organism.role}" aria-hidden="true"></i><b>${organism.name}</b>`;
}
export function chainSequenceMarkup(order,count,{solved=false,wrongAt=-1,editable=false}={}){
  const names=order.map(id=>QUIZ_ORGANISMS[id].name);
  return `<ol class="chain-slots ${count===5?'long-chain':''} ${solved?'solved':''}" style="--card-count:${count}" aria-label="${editable?'내가 연결한 먹이사슬':'완성한 먹이사슬: '+names.join(', ')}">${Array.from({length:count},(_,i)=>{
    const id=order[i],name=id?QUIZ_ORGANISMS[id].name:'';
    const content=`<small class="slot-number">${i+1}</small>${id?organismPicture(id):'<span class="slot-empty" aria-hidden="true">?</span><b>그림 놓는 곳</b>'}`;
    const card=editable?`<button id="quizSlot-${i}" class="chain-slot ${id?'filled':''}" data-slot="${i}" ${!id||solved?'disabled':''} aria-label="${i+1}번째 ${name||'빈 칸'}${id&&!solved?', 이곳부터 다시 놓기':''}">${content}</button>`:`<div class="chain-slot filled">${content}</div>`;
    return `<li class="chain-node">${card}${i<count-1?`<span class="chain-arrow ${i<order.length-1?'connected':''} ${i===wrongAt?'needs-review':''}" aria-hidden="true">→</span>`:''}</li>`;
  }).join('')}</ol>`;
}
export function feedingPictureMarkup(eater,food,{question=false}={}){
  const picture=id=>id?organismPicture(id):'<span class="meal-question" aria-hidden="true">?</span><b>어떤 생물일까요?</b>';
  return `<div class="feeding-scene ${question?'question-scene':'revealed-scene'}"><div class="feeding-eater"><small>먹는 생물</small><div class="meal-character">${picture(eater)}</div></div><div class="feeding-action" aria-hidden="true">${question?(eater?'무엇을 먹을까요?':'누가 먹을까요?'):'냠냠!'}</div><div class="feeding-food"><small>먹히는 생물 · 먹이</small><div class="meal-plate">${picture(food)}</div></div></div>`;
}
export function pictureQuizMarkup(puzzle){
  const {quiz,choice,solved,message}=puzzle;
  const eater=quiz.mode==='food'?quiz.subject:solved?choice:null;
  const food=quiz.mode==='hunter'?quiz.subject:solved?choice:null;
  return `${feedingPictureMarkup(eater,food,{question:!solved})}<p class="picture-choice-title">${solved?'먹고 먹히는 관계를 그림으로 확인했어요!':'빈자리에 들어갈 생물 그림을 눌러요.'}</p><div class="picture-choices" role="group" aria-label="생물 그림 보기">${quiz.choices.map(id=>`<button id="pictureChoice-${id}" class="organism-card ${id===choice?(solved?'answer-correct':'answer-retry'):''}" data-picture-choice="${id}" ${solved?'disabled':''} aria-label="${QUIZ_ORGANISMS[id].name}">${organismPicture(id)}${solved&&id===choice?'<small>✓ 정답</small>':''}</button>`).join('')}</div><p id="quizFeedback" class="quiz-feedback ${solved?'correct':choice?'wrong':''}" role="status" aria-live="polite">${message}</p>`;
}
