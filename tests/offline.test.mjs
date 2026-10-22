import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('the delivered HTML embeds all scripts, styles and both image sheets',()=>{
  assert.equal(/<script[^>]+src=|<link[^>]+stylesheet/i.test(html),false);
  assert.equal(html.includes('type="module"'),false);
  assert.equal((html.match(/data:image\/webp;base64,/g)||[]).length,4);
  assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,2);
  assert.equal(/<!-- GAME_(?:CODE|STYLE) -->|__ANIMALS__|__PROPS__/.test(html),false);
});
test('the page contains no outbound service or SDK requests',()=>{
  assert.equal(/https?:\/\/|firebase|googleapis|gstatic|\bfetch\s*\(|\bWebSocket\b|XMLHttpRequest|sendBeacon|@import/i.test(html),false);
  assert.equal(/\bimport\s/.test(html),false);
});
test('every HTML ID is unique and primary solo controls are present',()=>{
  const markup=html.slice(0,html.indexOf('<script>'));
  const ids=Array.from(markup.matchAll(/\bid="([^"]+)"/g),m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ['startButton','joystick','actionButton','missionProgress','roundPanel','summaryPanel','helpDialog','soundDialog','soundButton','musicEnabled','effectsEnabled','soundVolume','soundPreview','openWebDirect','webPanel','webContent'])assert.ok(ids.includes(id));
});
