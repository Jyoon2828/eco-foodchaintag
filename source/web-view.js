import {QUIZZES} from './quiz.js';
import {chainSequenceMarkup} from './quiz-view.js';
import {WEB_ORGANISMS,WEB_POSITIONS,WEB_STAGES,WEB_PATHS,webName,isBaseEdge,webEdgeGeometry} from './food-web.js';
import {webPicture} from './web-art.js';

export const webEscape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function webEdgeAppearance(activity,food,eater){
  const absent=food===activity.removed||eater===activity.removed;
  const path=activity.highlightPath===null?null:WEB_PATHS[activity.highlightPath];
  const highlighted=path?path.some((id,i)=>id===food&&path[i+1]===eater):activity.inspected?food===activity.inspected||eater===activity.inspected:true;
  return {absent,opacity:absent?.13:highlighted?1:.16,color:isBaseEdge(food,eater)?'#5e8858':'#be8437'};
}
export function webBoardMarkup(activity){
  const paths=activity.edges.map(([food,eater])=>{
    const {path}=webEdgeGeometry(food,eater),style=webEdgeAppearance(activity,food,eater),kind=isBaseEdge(food,eater)?'base':'new';
    return `<path d="${path}" fill="none" stroke="${style.color}" stroke-width="4" opacity="${style.opacity}" ${style.absent?'stroke-dasharray="8 7"':''} marker-end="url(#webArrow-${kind})"><title>${webName(food)} → ${webName(eater)}</title></path>`;
  }).join('');
  const nodes=Object.keys(WEB_ORGANISMS).map(id=>{
    const [x,y]=WEB_POSITIONS[id],absent=activity.removed===id,selected=activity.selected===id||activity.inspected===id;
    return `<button id="webNode-${id}" class="web-node ${selected?'selected':''} ${absent?'absent':''}" style="left:${x/10}%;top:${y/5.6}%" data-web-node="${id}" aria-pressed="${selected}" aria-label="${webName(id)}${absent?', 지금은 가려져 있어요':''}${selected?', 선택됨':''}">${webPicture(id)}${absent?'<small>잠시 가림</small>':''}</button>`;
  }).join('');
  return `<p class="web-small-screen">작은 화면에서는 그림을 옆으로 밀어 살펴봐요.</p><div id="webBoardScroll" class="web-board-scroll" tabindex="0" role="region" aria-label="먹이그물 그림, 작은 화면에서는 가로로 이동"><div class="web-board"><svg viewBox="0 0 1000 560" aria-hidden="true" focusable="false"><defs><marker id="webArrow-base" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="14" refX="12" refY="7" orient="auto"><path d="M1 1 L13 7 L1 13 Z" fill="#5e8858"/></marker><marker id="webArrow-new" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="14" refX="12" refY="7" orient="auto"><path d="M1 1 L13 7 L1 13 Z" fill="#be8437"/></marker></defs>${paths}</svg>${nodes}</div></div>`;
}
function webInspector(activity){
  if(!activity.inspected)return '';
  const {food,eaters}=activity.neighbors(activity.inspected),name=webName(activity.inspected);
  return `<div class="web-inspector"><b>${name}의 남아 있는 관계</b><span>먹이: ${food.length?food.map(webName).join(', '):'이 그림에 표시된 먹이가 없어요.'}</span><span>이 생물을 먹는 생물: ${eaters.length?eaters.map(webName).join(', '):'이 그림에 표시된 생물이 없어요.'}</span></div>`;
}
function webConnectionList(activity){
  return `<details id="webConnections" class="web-connections"><summary>연결한 관계 ${activity.edges.length}개 살펴보기·수정</summary><div>${activity.edges.map(([a,b])=>isBaseEdge(a,b)?`<span class="web-edge-chip base">${webName(a)} → ${webName(b)} <small>가져온 관계</small></span>`:`<button data-web-remove="${a},${b}" aria-label="${webName(a)}에서 ${webName(b)} 연결 지우기">${webName(a)} → ${webName(b)} <span aria-hidden="true">×</span></button>`).join('')}</div></details>`;
}
function webPathChoices(activity){
  if(!activity.complete)return '';
  return `<details id="webPaths" class="web-paths"><summary>이 먹이그물 안에서 다른 먹이사슬 찾기</summary><div>${WEB_PATHS.map((path,i)=>`<button data-web-path="${i}" aria-pressed="${activity.highlightPath===i}">${path.map(webName).join(' → ')}</button>`).join('')}</div></details>`;
}
export function foodWebMarkup(activity,hasGameRecords){
  const stage=activity.stage,step=WEB_STAGES.indexOf(stage),feedback=`<p id="webFeedback" class="web-feedback" role="status" aria-live="polite">${activity.feedback}</p>`;
  const title={intro:'먹이사슬들이 만나면?',connect:'화살표를 더해 먹이그물 만들기',observe:'개구리가 없다면, 뱀의 먹이는?',reflect:'연결한 그림을 근거로 말해요',complete:'여러 먹이사슬이 얽힌 먹이그물!'}[stage];
  let body='';
  if(stage==='intro'){
    body=`<p class="web-intro-copy">먹이사슬 탐험에서 만난 한 줄 먹이사슬을 가져왔어요.<br>자연에서는 한 생물이 여러 먹이를 먹거나 여러 생물에게 먹히기도 해요.</p>${chainSequenceMarkup(QUIZZES[3].chain,5,{solved:true})}<div class="web-new-friends"><div>${webPicture('mouse')}</div><div>${webPicture('sparrow')}</div><p>생쥐와 참새도 함께 살아요.<br>원래 먹이사슬에 새로운 관계를 더해 볼까요?</p></div><button id="beginWeb" class="primary wide">먹이사슬에서 먹이그물로 출발!</button>`;
  }else{
    const board=webBoardMarkup(activity);
    if(stage==='connect')body=`<p class="web-instruction"><b>먹히는 생물</b>을 먼저, <b>먹는 생물</b>을 다음에 눌러요. 같은 생물에서 화살표를 여러 개 만들 수 있어요.</p><div class="web-progress"><b>단서의 먹이관계 ${activity.edges.length} / 10개</b><span>초록: 가져온 먹이사슬 · 갈색: 새 연결</span></div><div class="web-hints"><p><b>생쥐 단서</b> 벼의 낟알을 먹어요. 뱀의 먹이가 될 수 있어요.</p><p><b>참새 단서</b> 벼의 낟알과 메뚜기를 먹어요. 뱀과 매의 먹이가 될 수 있어요.</p></div>${board}${feedback}<div class="web-tools"><button id="webUndo" ${activity.history.length?'':'disabled'}>새 연결 하나 되돌리기</button><button id="webReset" ${activity.history.length?'':'disabled'}>새 연결만 지우기</button><button id="webCheck" class="primary">먹이그물 확인하기</button></div>${webConnectionList(activity)}${activity.buildChecked?'<button id="webNext" class="primary wide">이제 남아 있는 먹이 살펴보기 →</button>':''}`;
    if(stage==='observe')body=`<p class="web-instruction">개구리를 잠시 가리고, 뱀에게 오는 다른 화살표를 찾아요. 생물 그림을 누르면 그 생물과 연결된 관계가 강조돼요.</p><div class="web-observe-toggle"><button id="toggleFrog" class="secondary" aria-pressed="${activity.removed==='frog'}">${activity.removed?'개구리 다시 보이기':'개구리 가려보기'}</button><span>가려지는 생물과 직접 이어진 화살표만 흐려져요.</span></div>${board}${webInspector(activity)}${feedback}${activity.observed?`<div class="web-alternative"><h3>개구리 대신, 뱀에게 남은 먹이 두 가지를 골라요.</h3><div>${['mouse','sparrow','grasshopper','rice'].map(id=>`<button class="organism-card ${activity.alternatives.has(id)?'found':''}" data-web-alternative="${id}" ${activity.alternatives.has(id)||!activity.removed?'disabled':''} aria-label="${webName(id)}${activity.alternatives.has(id)?', 찾았어요':''}">${webPicture(id)}${activity.alternatives.has(id)?'<small>✓ 찾았어요</small>':''}</button>`).join('')}</div><p>${activity.alternatives.size} / 2가지 찾음</p></div>`:''}${webPathChoices(activity)}<button id="webNext" class="primary wide" ${activity.observed&&activity.alternatives.size===2?'':'disabled'}>내 생각 정리하기 →</button>`;
    if(stage==='reflect')body=`${board}<div class="web-evidence"><b>우리가 그림에서 찾은 근거</b><p>개구리를 가려도 <strong>생쥐 → 뱀</strong>, <strong>참새 → 뱀</strong> 연결이 남아 있었어요.</p></div><label class="web-reflection-label" for="webReflection">먹이사슬과 먹이그물은 어떻게 다른가요?<small>찾아본 먹이관계 한 가지를 근거로 내 생각을 적어 보세요.</small></label><textarea id="webReflection" maxlength="180" rows="3" placeholder="먹이사슬은 ___, 먹이그물은 ___였어요. 예를 들어 ___가 없을 때도 ___ → ___ 관계가 남아 있었어요.">${webEscape(activity.reflection)}</textarea><p id="webWritingCount" class="web-writing-note">${activity.reflection.length} / 180자 · 쓴 내용은 이 기기 안에만 남아요.</p><button id="webNext" class="primary wide" ${activity.reflection.trim()?'':'disabled'}>먹이그물 탐험 마치기</button>`;
    if(stage==='complete')body=`<p class="web-intro-copy">7종류 생물의 먹이관계 10개를 연결하고, 다른 먹이 두 가지도 찾았어요.</p>${board}${webInspector(activity)}<div class="web-definition"><b>먹이그물</b><p>여러 개의 먹이사슬이 서로 얽혀 그물처럼 연결된 관계예요.<br>한 종류의 먹이가 없어도 다른 먹이를 먹을 수 있지만, 변화의 영향이 사라지는 것은 아니에요.</p></div><div class="web-my-thought"><b>나의 생각</b><p>${webEscape(activity.reflection)}</p></div>${webPathChoices(activity)}<button id="saveWeb" class="primary wide">내 먹이그물과 생각을 그림으로 저장</button><p id="webSaveStatus" class="web-save-status" role="status"></p>`;
  }
  return `<div class="web-page-header"><span class="eyebrow">먹이사슬에서 먹이그물로</span><h2>${title}</h2><ol class="web-steps" aria-label="활동 순서">${['사슬 가져오기','그물 만들기','변화 살피기','내 생각','완료'].map((name,i)=>`<li class="${i===step?'current':i<step?'done':''}" ${i===step?'aria-current="step"':''}>${i+1} ${name}</li>`).join('')}</ol></div>${body}<p class="web-model-note">학습을 위해 대표 먹이관계를 단순화한 그림이에요. 이 그림에 없는 관계도 있고, 종류와 계절에 따라 먹이는 달라질 수 있어요.</p><button id="webBack" class="secondary wide">${hasGameRecords?'먹이사슬 탐험 기록으로 돌아가기':'처음 화면으로 돌아가기'}</button>`;
}
