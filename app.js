import {createWorld,addPlayer,syncMembers,startRound,step,packWorld,unpackWorld,ROLES,groupSummary,dist,findPath} from './engine.js';
import {screenVectorToWorld} from './projection.js';
import {Renderer} from './render.js';
import {Network} from './network.js';
import {quizForRole,isCorrect} from './quiz.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),classId=(params.get('class')||'class4').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)||'class4';
const teacherMode=params.get('mode')==='teacher';
const S={net:null,teacher:false,host:false,demo:false,entered:false,world:null,meta:{},members:{},inputs:{},boards:{},me:null,group:1,seat:1,skin:0,action:0,keys:new Set(),joystick:{x:0,y:0},target:null,route:[],token:crypto.randomUUID(),epoch:null,hostReceived:Date.now(),lastPacket:0,lastBeat:0,lastUI:0,lastMemberSync:0,lastEvent:0,overlayKey:'',boardTimer:0,quizDone:{}};
let noticeTimer,toastTimer;
function notice(text){$('notice').textContent=text;$('notice').classList.remove('hidden');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.add('hidden'),7500);}
function fail(e){const code=String(e?.code||'');const msg=code.includes('permission')?'연결 권한을 확인해 주세요. Firebase Realtime Database 규칙과 교사 계정을 확인하세요.':code.includes('operation-not-allowed')?'Firebase Authentication에서 익명 로그인과 이메일/비밀번호를 켜 주세요.':code.includes('invalid-credential')?'교사 이메일과 비밀번호를 확인해 주세요.':code.includes('network')?'인터넷 연결을 확인해 주세요.':e?.message||'연결 중 문제가 생겼어요. 다시 시도해 주세요.';notice(msg);console.warn(e);}
const run=fn=>(...args)=>{try{return Promise.resolve(fn(...args)).catch(fail);}catch(e){fail(e);}};
function show(id){for(const el of document.querySelectorAll('main>.screen'))el.classList.toggle('hidden',el.id!==id);}
function studentUrl(){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('class',classId);return u.href;}
$('teacherLink').href=`?mode=teacher&class=${classId}`;
function pick(id,count,current,set){$(id).innerHTML=Array.from({length:count},(_,i)=>`<button type="button" data-v="${i+1}" class="${i+1===current?'selected':''}">${i+1}${id==='groupPicker'?'모둠':''}</button>`).join('');$(id).onclick=e=>{const b=e.target.closest('button');if(!b)return;set(+b.dataset.v);pick(id,count,+b.dataset.v,set);};}
pick('groupPicker',6,1,v=>S.group=v);pick('seatPicker',6,1,v=>S.seat=v);
$('lookPicker').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.skin=+b.dataset.skin;for(const el of $('lookPicker').querySelectorAll('button')){const selected=+el.dataset.skin===S.skin;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));}document.querySelector('.hero-art').dataset.look=String(S.skin);};
const renderer=new Renderer($('field'),(x,y)=>{if(!S.teacher&&S.world?.phase==='playing'){const p=S.world.players[S.me];if(!p)return;S.route=findPath(p,{x,y},p.role);S.target=S.route.shift()||null;}});
function gameView(){show('game');$('game').classList.toggle('teacher-mode',S.teacher);$('teacherPanel').classList.toggle('hidden',!S.teacher);$('modeLabel').textContent=S.demo?'혼자 연습 · 실제 연결 아님':'우리 반 숲';S.overlayKey='';}
async function net(teacher){if(!S.net){const n=new Network(classId,fail);try{await n.init(teacher);S.net=n;}catch(e){n.dispose();throw e;}S.net.onConnection=online=>{$('connection').textContent=online?'연결됨':'재연결 중';if(!online){S.target=null;S.joystick={x:0,y:0};if(S.host&&S.world?.phase==='playing')S.world.phase='paused';}};}return S.net;}
function bindWatchers(){
  S.net.watch('meta',m=>{
    if(!m)return;
    if(S.epoch&&m.epoch&&S.epoch!==m.epoch&&!S.teacher){
      S.entered=false;S.net.member=null;S.net.presenceStop?.();$('centerOverlay').classList.remove('hidden');$('overlayContent').innerHTML='<h2>새로운 탐험이 열렸어요</h2><p>입장 화면에서 모둠과 번호를 다시 골라 주세요.</p><button id="rejoin" class="primary">다시 입장하기</button>';$('rejoin').onclick=()=>location.reload();return;
    }
    S.meta=m;S.epoch=m.epoch;
    if(S.teacher&&m.hostToken!==S.token){S.host=false;notice('다른 교사 창이 수업을 진행하고 있습니다. 이 창의 조작을 멈춥니다.');}
  });
  S.net.watch('world',w=>{if(!w)return;S.hostReceived=Date.now();if(!S.host){S.world=unpackWorld(w);if(S.world.players[S.me])S.action=Math.max(S.action,S.world.players[S.me].actionSeq);if(w.phase==='reflection'&&!S.teacher&&S.entered)openReflection();}});
  S.net.watch('members',m=>{S.members=m||{};});
  S.net.watch('boards',b=>{S.boards=b||{};if(!$('reflection').classList.contains('hidden'))renderBoard();});
  if(S.teacher)S.net.watch('inputs',i=>{S.inputs=i||{};});
}
$('joinForm').onsubmit=run(async e=>{
  e.preventDefault();const b=$('joinForm').querySelector('[type=submit]');b.disabled=true;
  try{
    const n=await net(false),meta=await n.get('meta');if(!meta?.epoch)throw new Error('선생님이 아직 수업을 열지 않았어요. 잠시 뒤 다시 들어와 주세요.');
    const members=await n.get('members')||{};
    if(Object.entries(members).some(([id,m])=>id!==n.uid&&m.online&&m.epoch===meta.epoch&&m.group===S.group&&m.seat===S.seat))throw new Error('그 번호로 참여한 친구가 있어요. 우리 모둠에서 다른 번호를 골라 주세요.');
    if(Object.values(members).filter(m=>m.online&&m.epoch===meta.epoch).length>=36&&!members[n.uid]?.online)throw new Error('현재 36명이 참여하고 있어요. 선생님께 알려 주세요.');
    S.teacher=false;S.demo=false;S.meta=meta;S.epoch=meta.epoch;S.me=n.uid;S.entered=true;
    await n.presence({group:S.group,seat:S.seat,skin:S.skin,joinedAt:n.now()},S.epoch);bindWatchers();gameView();$('connection').textContent=n.connected?'연결됨':'재연결 중';
    if(!sessionStorage.getItem('foodTagHelp')){$('helpDialog').showModal();sessionStorage.setItem('foodTagHelp','1');}
  }finally{b.disabled=false;}
});
async function connectTeacher(){
  const n=S.net;await n.claimClass();const [meta,w]=await Promise.all([n.get('meta'),n.get('world')]);
  await n.hostLease(S.token);S.teacher=true;S.host=true;S.demo=false;S.entered=true;S.meta={...meta,hostToken:S.token,hostOnline:true,hostBeat:n.now()};S.epoch=meta?.epoch;S.world=w?unpackWorld(w):null;
  if(!S.epoch||!S.world)await newLesson(false);
  else {S.world.players||={};S.world.events||=[];S.world.plants||=[];if(S.world.phase==='playing')S.world.phase='paused';await publish();}
  $('duration').value=S.world.duration;$('botCount').value=S.world.bots;bindWatchers();gameView();$('connection').textContent='연결됨';
}
$('loginForm').onsubmit=run(async e=>{e.preventDefault();const b=$('loginForm').querySelector('button');b.disabled=true;try{const n=await net(true);await n.login($('email').value.trim(),$('password').value);$('password').value='';await connectTeacher();}finally{b.disabled=false;}});
async function newLesson(ask=true){
  if(ask&&!confirm('현재 놀이 기록과 모둠 결과를 지우고 새 수업을 열까요?'))return;
  S.quizDone={};S.epoch=crypto.randomUUID();S.world=createWorld(+$('duration').value,+$('botCount').value);S.inputs={};S.members={};S.boards={};S.overlayKey='';S.lastEvent=0;
  S.meta={epoch:S.epoch,hostToken:S.token,hostOnline:true,hostBeat:S.net?.now()||Date.now()};
  if(!S.demo)await S.net.update('',{meta:S.meta,world:packWorld(S.world),members:null,inputs:null,boards:null});
  if(S.demo&&S.teacher)demoMembers();
}
function demoMembers(){for(let i=0;i<25;i++){const id=`pupil_${i}`;S.members[id]={group:Math.floor(i/4)+1>6?6:Math.floor(i/4)+1,seat:i<24?i%4+1:5,online:true,epoch:S.epoch,joinedAt:i};}syncMembers(S.world,S.members);}
function practice(teacher=false){
  S.teacher=teacher;S.demo=true;S.host=true;S.entered=true;S.group=1;S.me=teacher?null:'practice_me';S.quizDone={};S.epoch='practice';S.meta={hostOnline:true};S.world=createWorld(60,2);S.boards={};S.members={};S.inputs={};
  if(teacher)demoMembers();else addPlayer(S.world,S.me,{group:1,label:'나',skin:S.skin});
  gameView();$('connection').textContent='이 기기에서 연습';if(!teacher)$('helpDialog').showModal();
}
$('practiceBtn').onclick=()=>practice(false);$('teacherDemo').onclick=()=>practice(true);
async function publish(){if(S.host&&!S.demo)await S.net.set('world',packWorld(S.world));}
function validHost(){if(!S.teacher&&!S.demo)return false;if(!S.host){notice('수업을 진행하는 교사 창에서 조작해 주세요.');return false;}return true;}
$('newClass').onclick=run(()=>validHost()&&newLesson());
$('startBtn').onclick=run(async()=>{
  if(!validHost())return;
  if(S.world.phase==='paused')S.world.phase='playing';
  else if(S.world.phase==='lobby'){S.world.duration=+$('duration').value;S.world.bots=+$('botCount').value;startRound(S.world,0);}
  else if(S.world.phase==='between'&&S.world.round<3)startRound(S.world,S.world.round+1);
  else if(S.world.phase==='reflection'||S.world.phase==='between')return notice('네 역할 탐험을 마쳤어요. 새 수업을 열면 다시 시작합니다.');
  S.overlayKey='';await publish();
});
$('pauseBtn').onclick=run(async()=>{if(!validHost())return;if(S.world.phase==='playing')S.world.phase='paused';else if(S.world.phase==='paused')S.world.phase='playing';S.overlayKey='';await publish();});
$('nextBtn').onclick=run(async()=>{if(!validHost())return;if(S.world.phase==='lobby')return notice('첫 라운드를 먼저 시작해 주세요.');if(S.world.round<3)startRound(S.world,S.world.round+1);else S.world.phase='reflection';S.overlayKey='';await publish();});
$('finishBtn').onclick=run(async()=>{if(!validHost())return;S.world.phase='reflection';S.overlayKey='';await publish();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.host&&S.world?.phase==='playing'){S.world.phase='paused';publish().catch(fail);}});
$('copyLink').onclick=run(async()=>{const url=studentUrl();try{await navigator.clipboard.writeText(url);notice('학생 공통 링크를 복사했어요.');}catch{$('shareUrl').value=url;$('linkDialog').showModal();$('shareUrl').select();}});
$('exitBtn').onclick=run(async()=>{if(S.teacher&&!confirm('교사 창을 나가면 숲이 멈춥니다. 나갈까요?'))return;if(S.host&&S.world?.phase==='playing'){S.world.phase='paused';await publish();}if(!S.demo&&S.net&&!S.teacher)await S.net.leave();location.href=studentUrl();});
$('logoutBtn').onclick=run(async()=>{if(!S.demo){S.world.phase='paused';await publish();await S.net.update('meta',{hostOnline:false});await S.net.logout();}location.reload();});
$('fullBtn').onclick=run(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();});
$('helpBtn').onclick=()=>$('helpDialog').showModal();for(const el of document.querySelectorAll('.dialog-close'))el.onclick=()=>el.closest('dialog').close();
function moveInput(){
  if(document.querySelector('dialog[open]')||$('game').classList.contains('hidden'))return {x:0,y:0,action:S.action};
  let x=S.joystick.x,y=S.joystick.y;const k=S.keys;
  if(k.has('ArrowLeft')||k.has('a'))x--;if(k.has('ArrowRight')||k.has('d'))x++;if(k.has('ArrowUp')||k.has('w'))y--;if(k.has('ArrowDown')||k.has('s'))y++;
  if(Math.hypot(x,y)>.05){S.target=null;S.route=[];const v=screenVectorToWorld(x,y);x=v.x;y=v.y;}
  else if(S.target&&S.world?.players[S.me]){const p=S.world.players[S.me],d=dist(p,S.target);if(d>18){x=(S.target.x-p.x)/d;y=(S.target.y-p.y)/d;}else S.target=S.route.shift()||null;}
  const n=Math.max(1,Math.hypot(x,y));return {x:x/n,y:y/n,action:S.action};
}
function action(){if(S.world?.phase==='playing'){S.action++;if(navigator.vibrate)navigator.vibrate(18);}}
$('actionBtn').onpointerdown=e=>{e.preventDefault();action();};
const joy=$('joystick');let pointer=null;
function joyMove(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,max=r.width*.3,n=Math.max(max,Math.hypot(dx,dy));S.joystick={x:dx/n,y:dy/n};$('stick').style.transform=`translate(${S.joystick.x*max}px,${S.joystick.y*max}px)`;S.target=null;S.route=[];}
joy.onpointerdown=e=>{e.preventDefault();pointer=e.pointerId;joy.setPointerCapture(pointer);joyMove(e);};joy.onpointermove=e=>{if(e.pointerId===pointer)joyMove(e);};
function release(){pointer=null;S.joystick={x:0,y:0};$('stick').style.transform='';}
joy.onpointerup=release;joy.onpointercancel=release;joy.onlostpointercapture=release;
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||$('game').classList.contains('hidden')||document.querySelector('dialog[open]'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();S.keys.add(e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase());if(e.key===' '&&!e.repeat)action();});
document.addEventListener('keyup',e=>S.keys.delete(e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase()));
window.addEventListener('blur',()=>{S.keys.clear();release();S.target=null;});
let packetBusy=false,writeFailures=0,worldBusy=false;
setInterval(()=>{
  if(!S.entered||!S.world)return;
  const now=Date.now();
  if(S.host){
    if(now-S.lastMemberSync>700){S.lastMemberSync=now;if(S.teacher){const current=Object.fromEntries(Object.entries(S.members).filter(([,m])=>m.epoch===S.epoch));syncMembers(S.world,current);}}
    let inputs=S.inputs;
    if(S.demo){inputs={};for(const p of Object.values(S.world.players))if(!p.bot&&p.id!==S.me)inputs[p.id]={x:Math.sin(now/2200+p.base),y:Math.cos(now/3000+p.base*2),action:Math.floor(now/4000)};if(S.me)inputs[S.me]=moveInput();}
    else inputs=Object.fromEntries(Object.entries(S.inputs).filter(([,i])=>i.epoch===S.epoch&&S.net.now()-i.at<650));
    step(S.world,inputs,.05);
    if(!S.demo&&!worldBusy&&now-S.lastPacket>(S.world.phase==='playing'?140:950)){
      S.lastPacket=now;worldBusy=true;publish().then(()=>writeFailures=0).catch(e=>{if(++writeFailures===1)fail(e);if(writeFailures>=3){S.world.phase='paused';notice('연결이 불안정하여 놀이를 멈췄습니다. 연결 후 다시 시작해 주세요.');}}).finally(()=>worldBusy=false);
    }
    if(!S.demo&&S.net.connected&&now-S.lastBeat>2200){S.lastBeat=now;S.net.update('meta',{hostBeat:S.net.now(),hostOnline:true}).catch(fail);}
  }else if(S.net?.connected&&S.world.phase==='playing'&&S.meta.hostOnline&&now-S.hostReceived<4000&&!packetBusy){
    packetBusy=true;S.net.sendInput(moveInput(),S.epoch).catch(fail).finally(()=>packetBusy=false);
  }
},50);
// Input publishing is coalesced by the SDK when outstanding; send at most 8Hz.
let inputGate=0;const originalSend=Network.prototype.sendInput;
Network.prototype.sendInput=function(...args){if(Date.now()-inputGate<125)return Promise.resolve();inputGate=Date.now();return originalSend.apply(this,args);};
function updateUI(){
  const w=S.world;if(!w)return;const me=w.players[S.me],role=me?.role??0;
  const seconds=Math.ceil(w.remaining);$('roundText').textContent=w.phase==='lobby'?'탐험 준비':`${w.round+1} / 4 라운드`;$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  if(me){$('rolePortrait').className=`animal portrait a${role}`;$('myLabel').textContent=S.demo?'혼자 연습':me.label;$('myRole').textContent=ROLES[role].name;$('foodHint').textContent=`먹이: ${ROLES[role].food} · 천적: ${ROLES[role].enemy}`;$('myScore').textContent=me.score;$('actionText').textContent=ROLES[role].skill;$('actionIcon').textContent=['↗','⌁','♧','↓'][role];$('cooldownText').textContent=me.cool>0?`${me.cool.toFixed(1)}초 뒤`:'준비 완료';$('actionBtn').style.opacity=me.cool>0?'.6':'1';
    $('respawnNotice').classList.toggle('hidden',me.respawn<=0||w.phase!=='playing');if(me.respawn>0)$('respawnNotice').innerHTML=`${ROLES[role].emoji} 다시 출발해요!<br><small>${Math.ceil(me.respawn)}초</small>`;
  }
  const stale=!S.demo&&!S.teacher&&(!S.net?.connected||!S.meta.hostOnline||Date.now()-S.hostReceived>5000);$('hostWarning').classList.toggle('hidden',!stale);
  if(S.teacher){
    const online=Object.values(S.members).filter(m=>m.online&&m.epoch===S.epoch).length;$('memberCount').textContent=`${online}명 접속`;
    $('startBtn').textContent=w.phase==='paused'?'놀이 계속하기':w.phase==='between'?'다음 라운드 시작':'첫 라운드 시작';$('startBtn').disabled=w.phase==='playing'||w.phase==='reflection'||w.round===3&&w.phase==='between';$('pauseBtn').textContent=w.phase==='paused'?'계속하기':'잠깐 멈춤';$('nextBtn').textContent=w.round<3?'다음 역할':'정리 활동';
    if(Date.now()-S.lastUI>900){S.lastUI=Date.now();$('teacherGroups').innerHTML=groupSummary(w).map(g=>{const board=S.boards[g.group];return `<button class="group-chip" data-group="${g.group}"><b>${g.group}모둠 · ${g.players}명</b><span>${g.score}번 먹이 경험</span><div class="link-dots">${[0,1,2,3].map(i=>g.links.includes(i)?'●':'○').join('')}</div><span>${board?.submitted?'✓ 결과 제출':'토의 준비'}</span></button>`;}).join('');}
  }
  const key=[w.phase,w.round,role,S.teacher,!!me].join(':');
  if(S.overlayKey!==key){S.target=null;S.route=[];S.overlayKey=key;overlay(w,me);}
  if(S.demo&&w.phase==='reflection'&&!S.teacher&&$('reflection').classList.contains('hidden'))openReflection();
  const recent=(w.events||[]).filter(e=>e.id>S.lastEvent&&(e.hunter===S.me||e.prey===S.me));if(recent.length){const e=recent.at(-1);S.lastEvent=e.id;if(e.type!=='skill'){const text=e.type==='rice'?'🌾 벼 → 메뚜기':`${ROLES[e.from].emoji} ${ROLES[e.from].name} → ${ROLES[e.to].name} ${ROLES[e.to].emoji}`;$('eventToast').textContent=text;$('eventToast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('eventToast').classList.add('hidden'),1800);}}
}
function overlay(w,me){
  const wrap=$('centerOverlay'),card=$('overlayContent');wrap.classList.toggle('hidden',w.phase==='playing');if(w.phase==='playing')return;
  const role=me?.role??0,next=(role+1)%4;
  if(w.phase==='lobby')card.innerHTML=`<div class="eyebrow">탐험 준비 완료</div>${!S.teacher?`<span class="animal a${role}"></span>`:''}<h2>${S.teacher?'우리 반 친구들을 기다려요':me?`첫 역할은 ${ROLES[role].name}!`:'숲에 들어가는 중이에요'}</h2><p>${S.teacher?'학생 공통 링크를 공유하고<br>모두 들어오면 첫 라운드를 시작하세요.':`먹이: ${ROLES[role].food} · 천적: ${ROLES[role].enemy}<br>선생님이 시작하면 함께 움직여요.`}</p>${S.demo&&!S.teacher?'<button id="practiceStart" class="primary">연습 시작하기</button>':''}`;
  if(w.phase==='paused')card.innerHTML='<div class="eyebrow">잠깐 멈춤</div><h2>이야기를 나누어요</h2><p>내가 먹은 생물과 나를 먹는 생물은 누구였나요?<br>선생님이 계속하기를 누르면 다시 움직여요.</p>';
  if(w.phase==='between'){
    const quiz=quizForRole(role),done=!!S.quizDone[`${S.epoch}:${w.round}`];
    card.innerHTML=`<div class="eyebrow">${w.round+1}라운드 탐험 완료</div><h2>${S.teacher?'먹이관계를 확인해요':'숲속 한 문제!'}</h2>${S.teacher?'<p>학생들이 방금 맡은 생물의 먹이관계를 확인하고 있어요.<br>답을 함께 이야기한 뒤 다음 라운드를 시작하세요.</p>':`<div class="round-quiz"><h3>${esc(quiz.question)}</h3><div id="quizChoices" class="quiz-choices">${quiz.choices.map((text,i)=>`<button type="button" data-answer="${i}" class="secondary" ${done?'disabled':''}>${esc(text)}</button>`).join('')}</div><p id="quizFeedback" aria-live="polite">${done?'✓ '+esc(quiz.explanation):'경험한 먹이관계를 떠올려 보세요.'}</p></div>`}<p>${w.round<3?`${!S.teacher?`다음에는 <b>${ROLES[next].name} 역할</b>로 바꾸어요.<br>`:''}선생님이 다음 라운드를 열면 출발해요.`:'모둠원과 탐험 기록을 모아 먹이사슬을 연결해 보세요.'}</p>${S.demo&&!S.teacher?`<button id="practiceNext" class="primary" ${done?'':'disabled'}>${w.round<3?'다음 역할로 탐험하기':'먹이사슬 연결하기'}</button>`:''}<small class="role-note">역할을 바꾸는 놀이예요. 생물이 다른 종류로 변하는 것은 아니에요.</small>`;
    if($('quizChoices'))$('quizChoices').onclick=e=>{
      const b=e.target.closest('[data-answer]');if(!b||S.world.phase!=='between')return;
      if(isCorrect(role,+b.dataset.answer)){S.quizDone[`${S.epoch}:${w.round}`]=true;overlay(w,me);}
      else{$('quizFeedback').textContent='다시 생각해 볼까요? '+quiz.explanation;b.classList.add('tried');b.setAttribute('aria-pressed','true');}
    };
  }
  if(w.phase==='reflection')card.innerHTML='<div class="eyebrow">탐험 정리</div><h2>먹이사슬을 연결해요</h2><p>모둠별 결과를 눌러 함께 살펴보세요.<br>실제 카드 놀이로도 이어갈 수 있어요.</p>';
  if($('practiceStart'))$('practiceStart').onclick=()=>{startRound(w,0);S.overlayKey='';};
  if($('practiceNext'))$('practiceNext').onclick=()=>{if(w.round<3)startRound(w,w.round+1);else{w.phase='reflection';openReflection();}S.overlayKey='';};
}
function frame(){if(S.world&&!$('game').classList.contains('hidden')){renderer.draw(S.world,S.me,S.teacher);if(S.entered)updateUI();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
const names={rice:'벼','0':'메뚜기','1':'개구리','2':'뱀','3':'매'};
function item(k){return k==='rice'?'<span class="rice">🌾</span>':`<span class="animal a${k}"></span>`;}
function board(){return S.boards[S.group]||{chain:'',reason:'',submitted:false,epoch:S.epoch};}
function chain(){return board().chain?board().chain.split(','):[];}
function openReflection(){show('reflection');renderBoard();}
function renderBoard(){
  const c=chain(),b=board();$('chainSlots').innerHTML=Array.from({length:5},(_,i)=>`${i?'<span class="chain-arrow">→</span>':''}<div class="chain-slot ${c[i]!==undefined?'filled':''}">${c[i]!==undefined?item(c[i])+names[c[i]]:i+1}</div>`).join('');
  $('chainChoices').innerHTML=['2','rice','3','0','1'].map(k=>`<button class="choice" data-k="${k}" ${c.includes(k)?'disabled':''}>${item(k)}${names[k]}</button>`).join('');
  if(document.activeElement!==$('reason'))$('reason').value=b.reason||'';
  const g=groupSummary(S.world).find(g=>g.group===S.group);$('recordLinks').innerHTML=`<span>${S.group}모둠의 탐험 기록</span>`+[0,1,2,3].map(i=>`<span>${g?.links.includes(i)?'✓':'○'} ${i===0?'벼':ROLES[i-1].name} → ${ROLES[i].name}</span>`).join('');
  $('submitChain').textContent=b.submitted?'✓ 모둠 결과 제출 완료':'모둠 결과 제출하기';
}
async function saveBoard(patch){
  const b={...board(),...patch,group:S.group,epoch:S.epoch,lastBy:S.me||'practice'};S.boards[S.group]=b;renderBoard();if(!S.demo)await S.net.set(`boards/${S.group}`,b);
}
$('chainChoices').onclick=run(async e=>{const b=e.target.closest('button');if(!b)return;const c=chain();if(c.length<5&&!c.includes(b.dataset.k)){c.push(b.dataset.k);await saveBoard({chain:c.join(','),submitted:false});$('chainFeedback').textContent='';}});
$('undoChain').onclick=run(async()=>{const c=chain();c.pop();await saveBoard({chain:c.join(','),submitted:false});$('chainFeedback').textContent='';});
$('reason').oninput=()=>{clearTimeout(S.boardTimer);const value=$('reason').value;S.boardTimer=setTimeout(()=>saveBoard({reason:value,submitted:false}).catch(fail),400);};
$('checkChain').onclick=()=>{$('chainFeedback').textContent=chain().join(',')==='rice,0,1,2,3'?'잘 연결했어요! 먹히는 생물에서 먹는 생물 쪽으로 이어졌어요.':'먹히는 생물부터 놓았나요? 화살표 방향과 먹이관계를 다시 이야기해 보세요.';};
$('submitChain').onclick=run(async()=>{clearTimeout(S.boardTimer);if(chain().join(',')!=='rice,0,1,2,3')return notice('먹이사슬의 연결을 먼저 확인해 주세요.');if(!$('reason').value.trim())return notice('개구리의 먹이와 천적을 이야기하고 적어 주세요.');await saveBoard({reason:$('reason').value.trim(),submitted:true});notice('모둠 결과를 제출했어요.');});
$('backToForest').onclick=e=>{e.preventDefault();gameView();};
$('teacherGroups').onclick=e=>{const b=e.target.closest('[data-group]');if(!b)return;const group=+b.dataset.group,g=groupSummary(S.world).find(g=>g.group===group),r=S.boards[group];const d=document.createElement('dialog');d.innerHTML=`<div class="eyebrow">GROUP ${group}</div><h2>${group}모둠의 탐험 기록</h2><p>${g.players}명 · 먹이 경험 ${g.score}번</p><div class="help-chain" style="font-size:22px">${r?.chain?r.chain.split(',').map(k=>esc(names[k])).join(' → '):'먹이사슬을 연결하고 있어요'}</div><p style="white-space:pre-wrap">${esc(r?.reason||'모둠 설명을 기다리고 있어요.')}</p><p class="small muted">${r?.submitted?'✓ 모둠 결과 제출 완료':'아직 제출 전이에요'}</p><button class="primary wide">확인</button>`;document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
$('exportBtn').onclick=()=>{const data={title:'먹이사슬 술래잡기 수업 결과',date:new Date().toISOString(),groups:groupSummary(S.world),boards:S.boards,records:Object.values(S.world.players).filter(p=>!p.bot).map(p=>({label:p.label,group:p.group,visited:p.visited,links:p.learned,score:p.score}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='먹이사슬_수업결과.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
if(teacherMode){show('teacherLogin');net(true).then(n=>{if(n.isTeacher)return connectTeacher();}).catch(fail);}
