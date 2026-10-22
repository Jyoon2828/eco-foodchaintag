import {createWorld,addPlayer,startRound,step,missionFor} from './engine.js';
import {isCorrect} from './quiz.js';

export class SoloSession{
  constructor(){this.start();this.world.phase='ready';}
  start(duration=90,bots=3){
    this.world=createWorld(duration,bots);this.world.solo=true;this.me=addPlayer(this.world,'me',{label:'나'});
    this.records=[];this.finished=false;startRound(this.world,0);return this.world;
  }
  tick(input,dt){
    const before=this.world.phase;step(this.world,{me:input},dt);
    if(before==='playing'&&this.world.phase==='between')this.recordRound();
  }
  recordRound(){
    const w=this.world,mission=missionFor(this.me,w.duration);
    let record=this.records.find(r=>r.round===w.round);
    if(!record){record={round:w.round,role:this.me.role,...mission,quizCorrect:false};this.records.push(record);}
    return record;
  }
  answer(order){
    if(this.world.phase!=='between'||!isCorrect(this.me.role,order))return false;
    const record=this.recordRound();record.quizCorrect=true;record.quizOrder=[...order];return true;
  }
  next(){
    if(this.world.phase!=='between'||!this.recordRound().quizCorrect)return false;
    if(this.world.round<3)startRound(this.world,this.world.round+1);
    else{this.world.phase='finished';this.finished=true;}
    return true;
  }
  pause(){if(this.world.phase==='playing'){this.world.phase='paused';return true;}return false;}
  resume(){if(this.world.phase==='paused'){this.world.phase='playing';return true;}return false;}
}
