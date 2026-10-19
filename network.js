import {firebaseConfig as localConfig} from './config.js';
export class Network {
  constructor(classId,onError){this.classId=classId;this.onError=onError;this.stops=[];this.offset=0;this.connected=false;}
  async init(teacher=false){
    let cfg=localConfig;
    if(!cfg.apiKey){try{const response=await fetch('/api/config');if(response.ok)cfg=(await response.json()).firebase||{};}catch{}}
    if(!cfg.apiKey||!cfg.databaseURL||!cfg.projectId)throw new Error('연결 설정이 필요합니다. README의 Firebase 설정 후 다시 접속하세요. 혼자 연습은 바로 할 수 있어요.');
    const base='https://www.gstatic.com/firebasejs/12.19.0/';
    const [a,b,c]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-database.js')]);
    this.A=b;this.D=c;this.app=a.initializeApp(cfg);this.auth=b.getAuth(this.app);this.db=c.getDatabase(this.app);
    await b.setPersistence(this.auth,b.browserLocalPersistence);
    await this.auth.authStateReady();
    if(!teacher&&!this.auth.currentUser)await b.signInAnonymously(this.auth);
    this.stops.push(c.onValue(c.ref(this.db,'.info/serverTimeOffset'),s=>{this.offset=s.val()||0;}));
    this.stops.push(c.onValue(c.ref(this.db,'.info/connected'),s=>{this.connected=!!s.val();this.onConnection?.(this.connected);}));
    return this;
  }
  get uid(){return this.auth?.currentUser?.uid;}
  get isTeacher(){return !!this.auth?.currentUser&&!this.auth.currentUser.isAnonymous;}
  now(){return Date.now()+this.offset;}
  path(p){return `foodTag/${this.classId}/${p}`;}
  ref(p){return this.D.ref(this.db,this.path(p));}
  async login(email,password){await this.A.signInWithEmailAndPassword(this.auth,email,password);}
  async logout(){await this.A.signOut(this.auth);}
  watch(p,fn){const stop=this.D.onValue(this.ref(p),s=>fn(s.val()),e=>this.onError?.(e));this.stops.push(stop);return stop;}
  async get(p){return (await this.D.get(this.ref(p))).val();}
  set(p,value){return this.D.set(this.ref(p),value);}
  update(p,value){return this.D.update(this.ref(p),value);}
  async claimClass(){
    const result=await this.D.runTransaction(this.ref('owner'),current=>current===null?this.uid:undefined);
    const owner=result.snapshot.val();if(owner!==this.uid)throw new Error('이 교실은 다른 교사 계정으로 열었습니다. 해당 계정으로 로그인하세요.');
  }
  async hostLease(token,takeover=false){
    let accepted=false;
    const result=await this.D.runTransaction(this.ref('meta'),current=>{
      if(current?.hostOnline&&this.now()-(current.hostBeat||0)<10000&&current.hostToken!==token&&!takeover)return;
      accepted=true;return {...current,hostToken:token,hostOnline:true,hostBeat:this.now()};
    });
    if(!accepted||!result.committed)throw new Error('다른 교사 창에서 수업을 진행 중입니다. 그 창을 닫고 10초 후 다시 연결하세요.');
    await this.D.onDisconnect(this.ref('meta/hostOnline')).set(false);
  }
  async presence(member,epoch){
    this.presenceStop?.();
    this.member={...member,joinedAt:member.joinedAt||this.now()};this.epoch=epoch;
    const session=this.presenceSession={};
    let resolveReady,rejectReady,settled=false,connecting=false;
    const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const fail=e=>{
      if(!settled){settled=true;this.member=null;this.presenceStop?.();rejectReady(e);}
      else this.onError?.(e);
    };
    const connect=async online=>{
      if(!online||!this.member||this.presenceSession!==session||connecting)return;
      connecting=true;
      try{
        // Seed a complete offline member so child-only cleanup writes validate.
        // Mark online only after both disconnect operations are registered.
        await this.update(`members/${this.uid}`,{...this.member,online:false,epoch:this.epoch});
        await this.D.onDisconnect(this.ref(`members/${this.uid}/online`)).set(false);
        await this.D.onDisconnect(this.ref(`inputs/${this.uid}`)).remove();
        if(!this.member||this.presenceSession!==session)return;
        await this.update(`members/${this.uid}`,{online:true});
        if(!settled){settled=true;resolveReady();}
      }catch(e){fail(e);}
      finally{connecting=false;}
    };
    this.presenceStop=this.D.onValue(this.D.ref(this.db,'.info/connected'),s=>connect(!!s.val()),fail);this.stops.push(this.presenceStop);
    return ready;
  }
  async leave(){this.member=null;this.presenceSession=null;this.presenceStop?.();if(this.uid){await this.update(`members/${this.uid}`,{online:false});await this.set(`inputs/${this.uid}`,null);}}
  sendInput(input,epoch){return this.set(`inputs/${this.uid}`,{...input,epoch,at:this.D.serverTimestamp()});}
  dispose(){this.member=null;this.presenceSession=null;for(const stop of this.stops)stop();this.stops=[];}
}
