import test from 'node:test';
import assert from 'node:assert/strict';
import {QUIZZES,PictureQuiz,isCorrect} from '../quiz.js';
import {pictureQuizMarkup,chainSequenceMarkup} from '../quiz-view.js';

test('each question is a picture of a meal with one missing organism',()=>{
  for(let role=0;role<4;role++){
    const puzzle=new PictureQuiz(role),html=pictureQuizMarkup(puzzle);
    assert.ok(html.includes('feeding-scene'));assert.ok(html.includes('meal-question'));
    assert.equal((html.match(/data-picture-choice=/g)||[]).length,3);
    assert.equal(/[→↔]/.test(html),false);
    assert.equal(puzzle.quiz.choices.filter(id=>isCorrect(role,id)).length,1);
  }
});
test('incorrect pictures can be retried and never form an incorrect eating scene',()=>{
  for(let role=0;role<4;role++){
    const p=new PictureQuiz(role),wrong=p.quiz.choices.find(id=>id!==p.quiz.answer);
    assert.equal(p.choose(wrong),false);assert.equal(p.solved,false);
    const html=pictureQuizMarkup(p);assert.ok(html.includes('meal-question'));assert.ok(html.includes('answer-retry'));
    assert.equal(p.choose(p.quiz.answer),true);assert.equal(p.solved,true);
    assert.equal(pictureQuizMarkup(p).includes('meal-question'),false);
  }
});
test('correct answers reveal both actual pictures and a plain eating sentence',()=>{
  for(let role=0;role<4;role++){
    const p=new PictureQuiz(role);p.choose(p.quiz.answer);const html=pictureQuizMarkup(p);
    assert.ok(html.includes(p.quiz.explanation));assert.ok(html.includes('revealed-scene'));assert.ok(html.includes('정답'));
    assert.equal(/[→↔]/.test(html),false);assert.equal(p.choose(p.quiz.choices.find(id=>id!==p.quiz.answer)),false);
    assert.equal(p.solved,true);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  }
});
test('unknown IDs, numeric choices and old ordered-array answers are rejected',()=>{
  for(let role=0;role<4;role++)for(const answer of [null,0,1,{},QUIZZES[role].chain,'unknown'])assert.equal(isCorrect(role,answer),false);
  const p=new PictureQuiz(0);assert.equal(p.choose('unknown'),false);assert.equal(p.choice,null);
});
test('the complete chain is still available as a picture summary',()=>{
  const html=chainSequenceMarkup(QUIZZES[3].chain,5,{solved:true});
  assert.equal((html.match(/class="chain-node"/g)||[]).length,5);
  assert.ok(html.includes('rice-picture'));for(let i=0;i<4;i++)assert.ok(html.includes('animal a'+i));
});
test('students with the same role keep separate choices and success',()=>{
  const a=new PictureQuiz(1),b=new PictureQuiz(1);
  a.choose(a.quiz.answer);b.choose(b.quiz.choices.find(id=>id!==b.quiz.answer));
  assert.equal(a.solved,true);assert.equal(b.solved,false);
  b.choose(b.quiz.answer);assert.equal(b.solved,true);
});
