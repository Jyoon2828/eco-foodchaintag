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
export function chainQuizMarkup(puzzle){
  const {order,bank,quiz,result,solved}=puzzle;
  const sequence=chainSequenceMarkup(order,quiz.chain.length,{solved,wrongAt:result?.wrongAt,editable:true});
  const cards=bank.map(id=>{
    const used=order.includes(id),name=QUIZ_ORGANISMS[id].name;
    return `<button id="quizCard-${id}" class="organism-card ${used?'used':''}" data-organism="${id}" ${used?'disabled':''} aria-pressed="${used}" aria-label="${name}${used?', 이미 놓은 그림':', 다음 칸에 놓기'}">${organismPicture(id)}${used?'<span class="card-used" aria-hidden="true">✓</span>':''}</button>`;
  }).join('');
  const bankMarkup=solved?'':`<div class="chain-bank-head"><b>아래 그림을 순서대로 눌러요</b><span>${order.length} / ${quiz.chain.length}개</span></div><div class="chain-bank" role="group" aria-label="먹이사슬에 넣을 그림">${cards}</div><p class="chain-edit-note">위에 놓은 그림을 누르면 그곳부터 다시 놓을 수 있어요.</p>`;
  const feedback=`<p id="quizFeedback" class="quiz-feedback ${result?.status||''}" role="status" aria-live="polite" ${result?'':'hidden'}>${result?.message||''}</p>`;
  const actions=solved?'':`<div class="chain-actions"><div class="chain-tools"><button id="undoChain" ${order.length?'':'disabled'}>하나 되돌리기</button><button id="clearChain" ${order.length?'':'disabled'}>처음부터 연결</button></div><button id="checkChain" class="primary chain-check" ${puzzle.complete?'':'disabled'}>연결 확인하기</button></div>`;
  return `<p class="chain-direction">먹히는 생물 <span aria-hidden="true">→</span> 먹는 생물</p><div class="chain-workspace">${sequence}</div>${bankMarkup}${feedback}${actions}`;
}
