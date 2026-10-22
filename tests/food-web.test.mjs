import test from 'node:test';
import assert from 'node:assert/strict';
import {FoodWebActivity,WEB_ORGANISMS,WEB_EDGES,WEB_BASE_EDGES,WEB_EXTRA_EDGES,WEB_PATHS,WEB_POSITIONS,webEdgeGeometry,webEdgeKey} from '../source/food-web.js';

function completeConnections(){
  const a=new FoodWebActivity();a.begin();
  for(const [food,eater] of WEB_EXTRA_EDGES){a.select(food);assert.equal(a.select(eater),'added');}
  return a;
}
test('the activity starts from the exact completed chain and adds a branched web',()=>{
  const a=new FoodWebActivity();assert.equal(a.stage,'intro');assert.deepEqual(a.edges,WEB_BASE_EDGES);
  assert.equal(a.edges.length,4);assert.equal(Object.keys(WEB_ORGANISMS).length,7);
  assert.equal(WEB_EDGES.length,10);assert.equal(new Set(WEB_EDGES.map(e=>webEdgeKey(...e))).size,10);
  assert.equal(a.complete,false);assert.equal(a.remaining,6);assert.equal(a.next(),false);
  for(const path of WEB_PATHS)for(let i=0;i<path.length-1;i++)assert.ok(WEB_EDGES.some(([food,eater])=>food===path[i]&&eater===path[i+1]));
});
test('two taps create a directed edge; self-taps cancel and duplicates do not accumulate',()=>{
  const a=new FoodWebActivity();assert.equal(a.select('rice'),'ignored');a.begin();
  assert.equal(a.select('rice'),'selected');assert.equal(a.selected,'rice');assert.equal(a.select('rice'),'cancelled');assert.equal(a.selected,null);
  a.select('rice');assert.equal(a.select('mouse'),'added');assert.equal(a.edges.length,5);
  a.select('rice');assert.equal(a.select('mouse'),'exists');assert.equal(a.edges.length,5);
  assert.equal(a.select('unknown'),'ignored');
});
test('reverse directions and unlisted relations are distinguished without asserting all unlisted diets false',()=>{
  const a=new FoodWebActivity();a.begin();a.select('mouse');assert.equal(a.select('rice'),'reversed');
  assert.match(a.feedback,/방향/);assert.equal(a.edges.length,4);
  a.select('hawk');assert.equal(a.select('grasshopper'),'outside');assert.match(a.feedback,/이 활동의 단서에는 없는/);
  assert.equal(a.selected,null);assert.equal(a.edges.length,4);
});
test('removal and undo affect new edges only, and reset preserves the original food chain',()=>{
  const a=completeConnections();assert.equal(a.complete,true);
  assert.equal(a.remove('rice','grasshopper'),false);assert.equal(a.remove('rice','mouse'),true);assert.equal(a.complete,false);
  assert.equal(a.history.length,5);assert.equal(a.undo(),true);assert.equal(a.history.length,4);
  assert.equal(a.reset(),true);assert.deepEqual(a.edges,WEB_BASE_EDGES);assert.equal(a.history.length,0);assert.equal(a.undo(),false);
  assert.deepEqual(new FoodWebActivity().edges,WEB_BASE_EDGES);
});
test('checking the full graph gates the next step and edits invalidate the check',()=>{
  const a=new FoodWebActivity();a.begin();assert.equal(a.check(),false);assert.equal(a.next(),false);
  const b=completeConnections();assert.equal(b.next(),false);assert.equal(b.check(),true);
  b.undo();assert.equal(b.buildChecked,false);assert.equal(b.next(),false);
  b.select('sparrow');b.select('hawk');assert.equal(b.check(),true);assert.equal(b.next(),true);assert.equal(b.stage,'observe');
  assert.equal(b.reset(),false);assert.equal(b.remove('sparrow','hawk'),false);
});
test('hiding the frog removes only its direct links and keeps two alternative snake foods',()=>{
  const a=completeConnections();a.check();a.next();const before=JSON.stringify(a.edges);
  assert.equal(a.toggleFrog(),true);assert.equal(a.removed,'frog');assert.equal(a.observed,true);
  assert.deepEqual(a.neighbors('snake').food.sort(),['mouse','sparrow']);
  assert.deepEqual(a.neighbors('grasshopper').eaters,['sparrow']);
  assert.equal(JSON.stringify(a.edges),before);assert.equal(a.toggleFrog(),true);assert.equal(a.removed,null);
  assert.deepEqual(a.neighbors('snake').food.sort(),['frog','mouse','sparrow']);
});
test('learners must find both alternatives after actually hiding the frog',()=>{
  const a=completeConnections();a.check();a.next();assert.equal(a.answerAlternative('mouse'),false);assert.equal(a.next(),false);
  a.toggleFrog();assert.equal(a.answerAlternative('grasshopper'),false);assert.equal(a.answerAlternative('frog'),false);
  assert.equal(a.answerAlternative('mouse'),true);assert.equal(a.answerAlternative('mouse'),true);assert.equal(a.alternatives.size,1);assert.equal(a.next(),false);
  assert.equal(a.answerAlternative('sparrow'),true);assert.equal(a.alternatives.size,2);a.toggleFrog();a.toggleFrog();
  assert.equal(a.alternatives.size,2);assert.equal(a.next(),true);assert.equal(a.stage,'reflect');assert.equal(a.removed,null);
});
test('reflection is personal text, stays local and can complete without automatic grading',()=>{
  const a=completeConnections();a.check();a.next();a.toggleFrog();a.answerAlternative('mouse');a.answerAlternative('sparrow');a.next();
  a.setReflection('   \n ');assert.equal(a.next(),false);a.setReflection('가'.repeat(220));assert.equal(a.reflection.length,180);
  a.setReflection('  생쥐와 참새에서 뱀으로 오는 화살표가 남아 있었어요.  ');assert.equal(a.next(),true);assert.equal(a.stage,'complete');
  assert.equal(a.reflection,'생쥐와 참새에서 뱀으로 오는 화살표가 남아 있었어요.');
  const fresh=new FoodWebActivity();assert.equal(fresh.reflection,'');assert.equal(fresh.alternatives.size,0);
});
test('every arrow ends near the eater card and never at its center',()=>{
  for(const [food,eater] of WEB_EDGES){
    const geometry=webEdgeGeometry(food,eater);for(const point of [geometry.start,geometry.end,geometry.c1,geometry.c2])for(const number of point)assert.ok(Number.isFinite(number));
    const [x,y]=WEB_POSITIONS[eater],distance=Math.hypot(geometry.end[0]-x,geometry.end[1]-y);
    assert.ok(distance>57&&distance<100);assert.ok(geometry.end[0]<x);assert.ok(geometry.start[0]>WEB_POSITIONS[food][0]);
  }
});
test('individual chains can be highlighted in the web without modifying its connections',()=>{
  const a=completeConnections(),edges=JSON.stringify(a.edges);assert.equal(a.showPath(2),true);assert.equal(a.highlightPath,2);
  a.showPath(2);assert.equal(a.highlightPath,null);a.inspect('snake');assert.equal(a.inspected,'snake');
  a.showPath(1);assert.equal(a.inspected,null);assert.equal(a.highlightPath,1);assert.equal(a.showPath(99),false);
  assert.equal(JSON.stringify(a.edges),edges);
});
