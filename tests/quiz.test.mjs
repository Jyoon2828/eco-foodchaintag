import test from 'node:test';
import assert from 'node:assert/strict';
import {QUIZZES,QUIZ_ORGANISMS,ChainQuiz,isCorrect,evaluateChain} from '../source/quiz.js';
import {chainQuizMarkup,chainSequenceMarkup} from '../source/quiz-view.js';
import {SoloSession} from '../source/solo-state.js';

function* permutations(values){
  if(values.length===0){yield [];return;}
  for(let i=0;i<values.length;i++)for(const rest of permutations(values.filter((_,j)=>i!==j)))yield [values[i],...rest];
}

test('picture chains progress from two organisms to the whole food chain',()=>{
  assert.deepEqual(QUIZZES.map(q=>q.chain.length),[2,3,3,5]);
  assert.deepEqual(QUIZZES[3].chain.map(id=>QUIZ_ORGANISMS[id].name),['벼','메뚜기','개구리','뱀','매']);
  for(const quiz of QUIZZES){
    assert.equal(new Set(quiz.chain).size,quiz.chain.length);
    for(let i=1;i<quiz.chain.length;i++)assert.equal(QUIZ_ORGANISMS[quiz.chain[i]].role,QUIZ_ORGANISMS[quiz.chain[i-1]].role+1);
  }
});

test('every reversed or rearranged full answer is rejected; only food-to-eater order passes',()=>{
  for(let role=0;role<4;role++){
    let accepted=0;
    for(const order of permutations(QUIZZES[role].chain))if(isCorrect(role,order))accepted++;
    assert.equal(accepted,1);
    for(const invalid of [0,1,null,'rice',[],[...QUIZZES[role].chain,'hawk'],Array(QUIZZES[role].chain.length).fill('rice')])assert.equal(isCorrect(role,invalid),false);
  }
});

test('the bank is mixed, has each needed picture once, and never arrives pre-solved',()=>{
  for(let role=0;role<4;role++)for(const random of [()=>0,()=>.5,()=>.999]){
    const p=new ChainQuiz(role,random);
    assert.deepEqual([...p.bank].sort(),[...QUIZZES[role].chain].sort());assert.equal(isCorrect(role,p.bank),false);
    assert.deepEqual(p.order,[]);assert.equal(p.complete,false);
  }
});

test('a picture cannot be placed twice or added from a different role',()=>{
  const p=new ChainQuiz(0);assert.equal(p.add('rice'),true);assert.equal(p.add('rice'),false);
  assert.equal(p.add('hawk'),false);assert.equal(p.add('unknown'),false);
  assert.equal(p.check().status,'incomplete');assert.equal(p.solved,false);
  assert.equal(p.add('grasshopper'),true);assert.equal(p.complete,true);assert.equal(p.add('rice'),false);
});

test('learners can undo, remove a suffix and reset a wrong chain before retrying',()=>{
  const p=new ChainQuiz(3);
  for(const id of ['grasshopper','rice','frog','snake','hawk'])p.add(id);
  const result=p.check();assert.equal(result.status,'wrong');assert.equal(result.wrongAt,0);
  assert.ok(result.message.includes('메뚜기 → 벼'));assert.equal(p.solved,false);
  assert.equal(p.undo(),true);assert.equal(p.complete,false);assert.equal(p.result,null);
  assert.equal(p.add('hawk'),true);assert.equal(p.removeFrom(1),true);
  assert.deepEqual(p.order,['grasshopper']);assert.equal(p.add('rice'),true);
  assert.equal(p.removeFrom(-1),false);assert.equal(p.removeFrom(5),false);
  assert.equal(p.clear(),true);assert.deepEqual(p.order,[]);assert.equal(p.undo(),false);
  for(const id of QUIZZES[3].chain)p.add(id);
  assert.equal(p.check().status,'correct');assert.equal(p.solved,true);
  assert.equal(p.undo(),false);assert.equal(p.clear(),false);assert.equal(p.removeFrom(0),false);
});

test('feedback points to the first invalid food relation and keeps valid links intact',()=>{
  const result=evaluateChain(3,['rice','grasshopper','snake','frog','hawk']);
  assert.equal(result.status,'wrong');assert.equal(result.wrongAt,1);
  assert.ok(result.message.includes('메뚜기 → 뱀'));
  const p=new ChainQuiz(3);for(const id of ['rice','grasshopper','snake','frog','hawk'])p.add(id);p.check();
  const html=chainQuizMarkup(p);
  assert.equal((html.match(/needs-review/g)||[]).length,1);
  assert.equal((html.match(/chain-arrow connected/g)||[]).length,4);
  assert.ok(html.includes('role="status"'));assert.ok(html.includes('data-slot="1"'));
});

test('picture markup labels every organism and locks confirmation until all cards are placed',()=>{
  const p=new ChainQuiz(3);
  let html=chainQuizMarkup(p);assert.match(html,/<button id="checkChain"[^>]*disabled/);
  assert.equal((html.match(/data-organism=/g)||[]).length,5);
  for(const [id,organism] of Object.entries(QUIZ_ORGANISMS)){
    assert.ok(html.includes(`data-organism="${id}"`));assert.ok(html.includes(organism.name));
  }
  assert.ok(html.includes('rice-picture'));for(let i=0;i<4;i++)assert.ok(html.includes('animal a'+i));
  p.add('rice');html=chainQuizMarkup(p);assert.match(html,/<button id="quizCard-rice"[^>]*disabled/);
  for(const id of QUIZZES[3].chain.slice(1))p.add(id);
  html=chainQuizMarkup(p);assert.doesNotMatch(html,/<button id="checkChain"[^>]*disabled/);
  p.check();html=chainQuizMarkup(p);assert.ok(html.includes('잘 연결했어요!')); 
  assert.equal((html.match(/data-organism=/g)||[]).length,0);assert.equal(html.includes('id="checkChain"'),false);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const summary=chainSequenceMarkup(QUIZZES[3].chain,5,{solved:true});
  assert.equal((summary.match(/class="chain-node"/g)||[]).length,5);assert.equal(summary.includes('<button'),false);
});

test('the session advances only after an actual complete picture chain and stores a copy',()=>{
  const s=new SoloSession();s.start(30,0);
  assert.equal(s.answer(QUIZZES[0].chain),false);
  for(let role=0;role<4;role++){
    while(s.world.phase==='playing')s.tick({},.1);
    assert.equal(s.next(),false);assert.equal(s.answer(1),false);
    assert.equal(s.answer(QUIZZES[role].chain.slice(0,-1)),false);
    assert.equal(s.answer([...QUIZZES[role].chain].reverse()),false);assert.equal(s.next(),false);
    const order=[...QUIZZES[role].chain];assert.equal(s.answer(order),true);order[0]='changed';
    assert.deepEqual(s.records[role].quizOrder,QUIZZES[role].chain);
    assert.equal(s.next(),true);
  }
  assert.equal(s.finished,true);s.start();assert.equal(s.records.length,0);
});
