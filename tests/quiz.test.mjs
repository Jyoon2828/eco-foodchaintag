import test from 'node:test';
import assert from 'node:assert/strict';
import {QUIZZES,quizForRole,isCorrect} from '../quiz.js';
test('each role has exactly one correct choice and rejects invalid input',()=>{for(let r=0;r<4;r++){const q=quizForRole(r);assert.equal(q,QUIZZES[r]);assert.equal(q.choices.filter((_,i)=>isCorrect(r,i)).length,1);assert.ok(q.explanation.length>10);for(const invalid of [-1,3,NaN,undefined,'1',1.5])assert.equal(isCorrect(r,invalid),false);}});
test('food-chain arrows and both predator/prey teaching points remain correct',()=>{assert.equal(QUIZZES[0].choices[QUIZZES[0].answer],'벼 → 메뚜기');assert.match(QUIZZES[1].choices[QUIZZES[1].answer],/먹기도 하고 먹히기도/);assert.equal(QUIZZES[2].choices[QUIZZES[2].answer],'개구리 → 뱀');assert.equal(QUIZZES[3].choices[QUIZZES[3].answer],'벼 → 메뚜기 → 개구리 → 뱀 → 매');});
