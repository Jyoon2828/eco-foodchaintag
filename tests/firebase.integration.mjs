import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import * as D from 'firebase/database';
import {Network} from '../network.js';
import {createWorld,syncMembers} from '../engine.js';

const endpoint=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if(!endpoint)throw new Error('Run with the Firebase Realtime Database emulator; production is never used.');
const [host,port]=endpoint.split(':');
const env=await initializeTestEnvironment({projectId:'demo-foodtag',database:{host,port:Number(port),rules:readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});
const epoch='lesson-1',base='foodTag/class4';
const teacher=env.authenticatedContext('teacher',{firebase:{sign_in_provider:'password'}}).database();
const networks=[];
async function seed(){
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(c=>c.database().ref(base).set({owner:'teacher',meta:{epoch}}));
}
function student(uid){
  const errors=[],n=new Network('class4',e=>errors.push(e));
  n.auth={currentUser:{uid}};n.db=env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).database();n.D=D;
  networks.push(n);return {n,errors};
}
const member={group:1,seat:1,skin:2,joinedAt:1};
async function waitFor(check){
  const end=Date.now()+6000;
  while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,40));}
  throw new Error('Timed out waiting for Firebase presence.');
}
try{
  await test('new student saves complete presence before entering and appears in the world',async()=>{
    await seed();const {n,errors}=student('pupil-1');
    await n.presence(member,epoch);
    const saved=await n.get('members/pupil-1');
    assert.equal(saved.online,true);assert.equal(saved.skin,2);assert.equal(saved.epoch,epoch);assert.deepEqual(errors,[]);
    const world=createWorld(60,0);syncMembers(world,await n.get('members'));
    assert.ok(world.players['pupil-1']);
    await n.sendInput({x:1,y:0,action:0},epoch);
    assert.equal((await D.get(D.ref(teacher,`${base}/inputs/pupil-1`))).val().x,1);
    n.dispose();D.goOffline(n.db);
  });
  await test('disconnect cleans up input, reconnect restores presence, and leave removes input',async()=>{
    await seed();const {n,errors}=student('pupil-2');await n.presence(member,epoch);
    await n.sendInput({x:0,y:1,action:1},epoch);
    D.goOffline(n.db);
    await waitFor(async()=>{
      const [m,i]=await Promise.all([D.get(D.ref(teacher,`${base}/members/pupil-2`)),D.get(D.ref(teacher,`${base}/inputs/pupil-2`))]);
      return m.val()?.online===false&&!i.exists();
    });
    D.goOnline(n.db);
    await waitFor(async()=>(await D.get(D.ref(teacher,`${base}/members/pupil-2`))).val()?.online===true);
    await n.sendInput({x:0,y:0,action:1},epoch);await n.leave();
    assert.equal((await n.get('members/pupil-2')).online,false);
    assert.equal((await D.get(D.ref(teacher,`${base}/inputs/pupil-2`))).exists(),false);
    assert.deepEqual(errors,[]);n.dispose();D.goOffline(n.db);
  });
  await test('failed membership rejects the join promise instead of entering an empty game',async()=>{
    await seed();const {n}=student('pupil-failed');
    await assert.rejects(n.presence({...member,group:9},epoch),/permission/i);
    assert.equal(await n.get('members/pupil-failed'),null);n.dispose();D.goOffline(n.db);
  });
  await test('cleanup permission allows only own input deletion and preserves teacher authority',async()=>{
    await seed();const {n}=student('pupil-safe');
    await assertSucceeds(D.remove(n.ref('inputs/pupil-safe')));
    await assertFails(n.sendInput({x:0,y:0,action:0},epoch));
    await assertFails(D.remove(n.ref('inputs/another-pupil')));
    await assertFails(n.set('world',{phase:'playing'}));
    await assertFails(n.set('owner','pupil-safe'));
    await assertFails(n.update('members/another-pupil',{...member,online:true,epoch}));
    n.dispose();D.goOffline(n.db);
  });
}finally{for(const n of networks)n.dispose();await env.cleanup();}
