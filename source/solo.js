import {ROLES,missionFor,hideProtected,HIDE_DURATION,dist,findPath} from './engine.js';
import {quizForRole} from './quiz.js';
import {project} from './projection.js';
import {Renderer} from './render.js';
import {MotionView,SIMULATION_STEP} from './motion-view.js';
import {SoloSession} from './solo-state.js';
import {ForestAudio,LearnerSound} from './audio.js';

const $=id=>document.getElementById(id);
let session=new SoloSession(),started=false,fullMap=false,action=0,target=null,route=[],shownRound=-1,lastUI=0,lastEvent=0,toastUntil=0,resumeAfterHelp=false,resumeAfterSound=false,windowFocused=true;
const audio=new ForestAudio(),learnerSound=new LearnerSound(audio);
const keys=new Set(),joystick={x:0,y:0};let pointer=null;
const renderer=new Renderer($('field'),(x,y)=>{
  if(session.world.phase!=='playing')return;
  route=findPath(session.me,{x,y},session.me.role);target=route.shift()||null;
});
function clearControls(){keys.clear();joystick.x=0;joystick.y=0;pointer=null;target=null;route=[];$('stick').style.transform='';}
function resetView(){renderer.positions={};renderer.motion=new MotionView();renderer.camera=project(session.me.x,session.me.y);}
function unlockSound(){audio.unlock().then(updateSoundControls);}
function start(){
  unlockSound();learnerSound.reset();
  session.start(+$('duration').value,+$('bots').value);started=true;shownRound=-1;action=0;lastEvent=0;toastUntil=0;fullMap=false;clearControls();resetView();
  $('home').hidden=true;$('summaryPanel').hidden=true;updateUI();audio.effect('start');
}
function goHome(){
  if(started&&!session.finished&&!confirm('처음으로 돌아가면 이번 탐험 기록이 지워져요. 돌아갈까요?'))return;
  audio.silence();
  clearControls();session=new SoloSession();started=false;shownRound=-1;fullMap=false;action=0;lastEvent=0;toastUntil=0;learnerSound.reset();resetView();
  $('home').hidden=false;$('roundPanel').hidden=true;$('summaryPanel').hidden=true;updateUI();
}
function input(){
  if(session.world.phase!=='playing'||$('helpDialog').open||$('soundDialog').open)return {x:0,y:0,action};
  let x=joystick.x,y=joystick.y;
  if(keys.has('ArrowLeft')||keys.has('a'))x--;if(keys.has('ArrowRight')||keys.has('d'))x++;
  if(keys.has('ArrowUp')||keys.has('w'))y--;if(keys.has('ArrowDown')||keys.has('s'))y++;
  if(Math.hypot(x,y)>.05){target=null;route=[];}
  else if(target){const d=dist(session.me,target);if(d>16){x=(target.x-session.me.x)/d;y=(target.y-session.me.y)/d;}else target=route.shift()||null;}
  const length=Math.max(1,Math.hypot(x,y));return {x:x/length,y:y/length,action};
}
function skill(){if(session.world.phase!=='playing'||$('helpDialog').open||$('soundDialog').open)return;if(session.me.role===0){target=null;route=[];}action++;navigator.vibrate?.(15);}
$('startButton').onclick=start;$('homeButton').onclick=goHome;$('restartButton').onclick=goHome;
$('pauseButton').onclick=()=>{if(!session.pause()){unlockSound();session.resume();}clearControls();updateUI();};
$('resumeButton').onclick=()=>{unlockSound();session.resume();updateUI();};
$('mapButton').onclick=()=>{fullMap=!fullMap;updateUI();};
$('actionButton').onpointerdown=e=>{e.preventDefault();skill();};
$('actionButton').onclick=e=>{if(e.detail===0)skill();};
$('fullButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('이 기기에서는 브라우저의 전체 화면 기능을 사용해 주세요.');}};
function showHelp(){resumeAfterHelp=session.pause();clearControls();$('helpDialog').showModal();updateUI();}
$('helpButton').onclick=showHelp;$('closeHelp').onclick=$('helpDone').onclick=()=>$('helpDialog').close();
$('helpDialog').onclose=()=>{if(resumeAfterHelp){unlockSound();session.resume();}resumeAfterHelp=false;updateUI();};
function updateSoundControls(){
  $('musicEnabled').checked=audio.music;$('effectsEnabled').checked=audio.effects;
  $('soundVolume').value=Math.round(audio.volume*100);$('volumeValue').textContent=`${Math.round(audio.volume*100)}%`;
  const muted=audio.volume===0||(!audio.music&&!audio.effects);
  $('soundButton').textContent=muted?'♪̸':'♫';$('soundButton').setAttribute('aria-label',`소리 설정${muted?' · 꺼짐':''}`);
  $('soundPreview').disabled=!audio.effects||audio.volume===0||!audio.available;
  $('soundStatus').textContent=!audio.available?'이 브라우저에서는 소리를 사용할 수 없어요. 탐험은 계속할 수 있어요.':muted?'소리가 꺼져 있어요.':!audio.unlocked?'시작 버튼을 누르면 소리가 켜져요.':'음악은 탐험 중에만 나와요. 멈추거나 다른 탭으로 가면 소리도 쉬어요.';
}
$('soundButton').onclick=()=>{resumeAfterSound=session.pause();clearControls();$('soundDialog').showModal();updateSoundControls();updateUI();};
$('closeSound').onclick=$('soundDone').onclick=()=>$('soundDialog').close();
$('soundDialog').onclose=()=>{if(resumeAfterSound){unlockSound();session.resume();}resumeAfterSound=false;updateUI();};
function configureSound(){
  unlockSound();audio.configure({music:$('musicEnabled').checked,effects:$('effectsEnabled').checked,volume:+$('soundVolume').value/100});updateSoundControls();
}
$('musicEnabled').onchange=$('effectsEnabled').onchange=configureSound;$('soundVolume').oninput=configureSound;
$('soundPreview').onclick=()=>{unlockSound();audio.effect('eat');};
function joyMove(e){const rect=$('joystick').getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2,max=rect.width*.3,length=Math.max(max,Math.hypot(dx,dy));joystick.x=dx/length;joystick.y=dy/length;target=null;route=[];$('stick').style.transform=`translate(${joystick.x*max}px,${joystick.y*max}px)`;}
$('joystick').onpointerdown=e=>{if(session.world.phase!=='playing')return;e.preventDefault();pointer=e.pointerId;$('joystick').setPointerCapture(pointer);joyMove(e);};
$('joystick').onpointermove=e=>{if(e.pointerId===pointer)joyMove(e);};
function release(){pointer=null;joystick.x=0;joystick.y=0;$('stick').style.transform='';}
$('joystick').onpointerup=release;$('joystick').onpointercancel=release;$('joystick').onlostpointercapture=release;
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||$('helpDialog').open||$('soundDialog').open||!started)return;
  const key=e.key.startsWith('Arrow')?e.key:e.key.toLowerCase();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(key))e.preventDefault();
  if(key===' '&&!e.repeat)skill();else keys.add(key);
});
document.addEventListener('keyup',e=>keys.delete(e.key.startsWith('Arrow')?e.key:e.key.toLowerCase()));
function backgroundPause(){clearControls();resumeAfterHelp=false;resumeAfterSound=false;session.pause();updateUI();}
window.addEventListener('blur',()=>{windowFocused=false;backgroundPause();});
window.addEventListener('focus',()=>{windowFocused=true;updateUI();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();else updateUI();});
for(const id of ['duration','bots'])$(id).onchange=()=>{$('durationNote').textContent=$('duration').value;$('friendCount').textContent=+$('bots').value*4;};
function toast(message){$('toast').textContent=message;toastUntil=performance.now()+1800;$('toast').hidden=false;}
function paintRound(){
  const record=session.recordRound(),quiz=quizForRole(session.me.role);shownRound=session.world.round;
  $('roundContent').innerHTML=`<span class="eyebrow">${record.round+1} / 4 역할 탐험 완료</span><h2>숲속 한 문제!</h2><div class="mission-result ${record.complete?'complete':''}"><b>${record.complete?'✓ 먹이 미션 성공!':'이번 먹이 미션 기록'}</b><span>${record.food} ${record.count}${record.unit} / 목표 ${record.goal}${record.unit}</span></div><h3>${quiz.question}</h3><div class="quiz-choices">${quiz.choices.map((text,i)=>`<button data-choice="${i}" ${record.quizCorrect?'disabled':''}>${text}</button>`).join('')}</div><p id="quizFeedback" class="quiz-feedback" role="status">${record.quizCorrect?'✓ '+quiz.explanation:'경험한 먹이관계를 떠올려 보세요.'}</p>${record.quizCorrect?`<button id="continueButton" class="primary wide">${record.round<3?'다음 역할로 출발하기':'탐험 기록 보기'}</button>`:''}<small class="role-note">학생이 다른 동물 역할을 맡는 놀이예요.<br>생물이 다른 종류로 변하는 과정은 아니에요.</small>`;
  for(const button of $('roundContent').querySelectorAll('[data-choice]'))button.onclick=()=>{
    unlockSound();
    if(session.answer(+button.dataset.choice)){audio.effect('correct');paintRound();$('continueButton').focus();}
    else{audio.effect('retry');$('quizFeedback').textContent='다시 생각해 볼까요? '+quiz.explanation;button.classList.add('tried');}
  };
  if($('continueButton'))$('continueButton').onclick=()=>{unlockSound();session.next();clearControls();resetView();shownRound=-1;if(session.finished)paintSummary();updateUI();audio.effect(session.finished?'finish':'start');};
}
function paintSummary(){
  const records=session.records,success=records.filter(r=>r.complete).length;
  $('summaryContent').innerHTML=`<span class="eyebrow">네 가지 역할 탐험 완료</span><h2>같은 숲, 서로 다른 먹이관계</h2><p>먹이 미션 <b>${success}개</b> 성공 · 먹이 경험 <b>${session.me.score}번</b><br>잡혀도 다시 도전하며 네 동물 역할을 모두 만났어요.</p><div class="summary-grid">${records.map(r=>`<div class="summary-item ${r.complete?'complete':''}"><i class="animal a${r.role}"></i><b>${ROLES[r.role].name}</b><span>${r.food} ${r.count}${r.unit}</span><small>목표 ${r.goal}${r.unit} · ${r.complete?'미션 성공':'체험 완료'}</small></div>`).join('')}</div><p class="chain">🌾 → 🦗 → 🐸 → 🐍 → 🦅</p><p>개구리는 메뚜기를 먹고, 뱀에게 먹혀요.<br>먹기도 하고 먹히기도 하는 생물이 있어요.</p><button id="againButton" class="primary wide">다시 탐험하기</button><small class="role-note">화살표는 먹히는 생물에서 먹는 생물 쪽이에요.</small>`;
  $('againButton').onclick=goHome;
}
function updateUI(){
  const world=session.world,me=session.me,active=started&&!session.finished,mission=missionFor(me,world.duration);
  audio.setScene(started&&world.phase==='playing',!document.hidden&&windowFocused);
  if(started)learnerSound.observe(world,mission);
  $('hud').hidden=!active;$('controls').hidden=!active||world.phase!=='playing';$('roundClock').hidden=!started;
  for(const id of ['pauseButton','mapButton','homeButton'])$(id).hidden=!started;
  $('pauseButton').disabled=!['playing','paused'].includes(world.phase);$('pauseButton').textContent=world.phase==='paused'?'계속하기':'잠깐 멈춤';
  $('pausePanel').hidden=world.phase!=='paused'||$('helpDialog').open||$('soundDialog').open;$('roundPanel').hidden=world.phase!=='between';$('summaryPanel').hidden=!session.finished;
  if(world.phase==='between'&&shownRound!==world.round){clearControls();paintRound();}
  $('mapButton').textContent=fullMap?'내 시점':'전체 맵';$('mapButton').setAttribute('aria-pressed',String(fullMap));
  const seconds=Math.ceil(world.remaining);$('roundLabel').textContent=`${world.round+1} / 4 라운드`;$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const preyCount=Object.values(world.players).filter(p=>p.bot&&p.role===me.role-1).length;
  $('portrait').className=`animal a${me.role}`;$('roleName').textContent=ROLES[me.role].name;$('foodHint').textContent=`먹이: ${ROLES[me.role].food}${me.role>0?' '+preyCount+'마리':''} · 천적: ${ROLES[me.role].enemy}`;
  $('missionTitle').textContent=mission.complete?'✓ 미션 성공!':'이번 역할 먹이 미션';$('missionCount').textContent=`${mission.count} / ${mission.goal}`;$('missionText').textContent=mission.text;$('missionProgress').max=mission.goal;$('missionProgress').value=Math.min(mission.count,mission.goal);$('hud').classList.toggle('complete',mission.complete);
  $('coverHint').textContent=me.role===3?'매는 날아서 나무·바위를 통과해요':me.hidden?(hideProtected(me)?`🛡 숨기 보호 ${(HIDE_DURATION-me.hideTime).toFixed(1)}초`:'보호 끝! 숨어 있어도 잡힐 수 있어요.'):'나무·풀숲에서 멈추면 3초 동안 보호돼요';$('coverHint').classList.toggle('exposed',me.hidden&&!hideProtected(me));
  $('actionName').textContent=ROLES[me.role].skill;$('actionIcon').textContent=['↗','⌁','♧','↓'][me.role];$('cooldown').textContent=me.cool>0?`${me.cool.toFixed(1)}초 뒤`:'준비 완료';$('actionButton').style.opacity=me.cool>0?'.65':'1';
  $('respawn').hidden=me.respawn<=0||world.phase!=='playing';if(me.respawn>0)$('respawn').innerHTML=`다시 출발해요!<br><small>${me.respawn.toFixed(1)}초 뒤</small>`;
  const events=world.events.filter(e=>e.id>lastEvent&&(e.hunter==='me'||e.prey==='me'));if(events.length){const e=events.at(-1);lastEvent=e.id;if(e.type!=='skill')toast(e.type==='rice'?'🌾 벼 → 메뚜기':`${ROLES[e.from].name} → ${ROLES[e.to].name}`);}
}
let lastFrame=performance.now(),accumulator=0;
function frame(now){
  const elapsed=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(!document.hidden){
    if(session.world.phase==='playing'){
      accumulator+=elapsed;
      while(accumulator>=SIMULATION_STEP&&session.world.phase==='playing'){renderer.motion.capture(session.world);session.tick(input(),SIMULATION_STEP);accumulator-=SIMULATION_STEP;}
    }else accumulator=0;
    renderer.draw(session.world,started?'me':null,!started||fullMap,{alpha:accumulator/SIMULATION_STEP});
    if(now-lastUI>=80){lastUI=now;updateUI();}
    if(toastUntil&&now>=toastUntil){$('toast').hidden=true;toastUntil=0;}
  }
  requestAnimationFrame(frame);
}
updateSoundControls();updateUI();requestAnimationFrame(frame);
