// Original, gently plucked forest music and short game cues, made on the device.
const FOREST_MELODY=[
  76,null,79,null,81,79,76,null,74,null,72,null,76,null,79,null,
  81,null,84,null,81,79,76,null,74,null,76,null,72,null,null,null,
  76,null,79,null,84,null,81,79,76,null,74,null,72,null,74,null,
  77,null,81,null,79,76,74,null,72,null,76,null,72,null,null,null
];
const FOREST_CHORDS=[[48,55,64],[45,52,60],[41,48,57],[43,50,59],
  [48,55,64],[45,52,60],[41,48,57],[43,50,62]];
const midiFrequency=note=>440*2**((note-69)/12);

export class ForestAudio {
  constructor({contextFactory=()=>{
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    return Context?new Context():null;
  },schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){
    this.contextFactory=contextFactory;this.schedule=schedule;this.cancel=cancel;
    this.context=null;this.unlocked=false;this.available=true;
    this.music=true;this.effects=true;this.volume=.35;
    this.playing=false;this.foreground=true;this.voices=new Set();this.recent=new Map();
    this.timer=null;this.musicRunning=false;this.beat=0;this.nextBeat=0;
  }
  unlock(){
    try{
      if(!this.context){
        this.context=this.contextFactory();
        if(!this.context){this.available=false;return Promise.resolve(false);}
        this.master=this.context.createGain();this.master.gain.value=this.volume;
        this.musicBus=this.context.createGain();this.musicBus.gain.value=.28;
        this.effectsBus=this.context.createGain();this.effectsBus.gain.value=.65;
        this.musicBus.connect(this.master);this.effectsBus.connect(this.master);
        this.master.connect(this.context.destination);
        this.context.onstatechange=()=>this._syncMusic();
      }
      this.unlocked=true;
      const resumed=this.foreground&&this.context.state!=='running'?this.context.resume():undefined;
      this._syncMusic();
      return Promise.resolve(resumed).then(()=>{
        if(!this.foreground){this._suspend();return false;}
        this._syncMusic();return true;
      }).catch(()=>false);
    }catch{this.available=false;return Promise.resolve(false);}
  }
  configure({music=this.music,effects=this.effects,volume=this.volume}={}){
    this.music=!!music;this.effects=!!effects;
    this.volume=Number.isFinite(Number(volume))?Math.max(0,Math.min(1,Number(volume))):this.volume;
    if(this.master)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.025);
    if(!this.effects||this.volume===0)this._stopVoices('effect');
    this._syncMusic();
  }
  setScene(playing,foreground=true){
    const stopped=this.playing&&!playing,left=this.foreground&&!foreground;
    this.playing=!!playing;this.foreground=!!foreground;
    this._syncMusic();
    if(stopped||left)this._stopVoices();
    if(left)this._suspend();
  }
  silence(){this._stopMusic();this._stopVoices();}
  _suspend(){
    try{Promise.resolve(this.context?.suspend()).catch(()=>{});}catch{}
  }
  _syncMusic(){
    const shouldPlay=this.unlocked&&this.context?.state==='running'&&this.foreground&&this.playing&&this.music&&this.volume>0;
    if(shouldPlay&&!this.musicRunning){
      this.musicRunning=true;this.beat=0;this.nextBeat=this.context.currentTime+.06;
      this._scheduleMusic();
    }else if(!shouldPlay)this._stopMusic();
  }
  _scheduleMusic(){
    if(!this.musicRunning)return;
    const now=this.context.currentTime;
    // Avoid a burst of late notes after a heavily delayed frame or device pause.
    if(this.nextBeat<now-.5)this.nextBeat=now+.06;
    while(this.nextBeat<now+.2){
      const step=this.beat%FOREST_MELODY.length,note=FOREST_MELODY[step],at=this.nextBeat;
      if(note!==null)this._note(note,at,.62,.23,'music');
      if(step%8===0){
        const chord=FOREST_CHORDS[Math.floor(step/8)];
        chord.forEach((n,i)=>this._note(n+12,at+i*.07,2.1,.065,'music'));
        this._note(chord[0],at,1.1,.18,'music');
      }
      this.beat++;this.nextBeat+=.48;
    }
    this.timer=this.schedule(()=>{this.timer=null;this._scheduleMusic();},80);
  }
  _stopMusic(){
    this.musicRunning=false;
    if(this.timer!==null){this.cancel(this.timer);this.timer=null;}
    this._stopVoices('music');
  }
  _stopVoices(kind){
    for(const voice of [...this.voices]){
      if(kind&&voice.kind!==kind)continue;
      try{voice.oscillator.stop();}catch{}
      voice.oscillator.disconnect();voice.gain.disconnect();this.voices.delete(voice);
    }
  }
  _tone(frequency,at,duration,level,kind='effect',wave='sine',endFrequency=null){
    if(!this.context||this.voices.size>=48)return;
    const oscillator=this.context.createOscillator(),gain=this.context.createGain();
    const voice={oscillator,gain,kind};this.voices.add(voice);
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,at);
    if(endFrequency)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,at+duration*.8);
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.linearRampToValueAtTime(level,at+.015);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain);gain.connect(kind==='music'?this.musicBus:this.effectsBus);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(voice);};
    oscillator.start(at);oscillator.stop(at+duration+.03);
  }
  _note(note,at,duration,level,kind='effect'){
    this._tone(midiFrequency(note),at,duration,level,kind);
  }
  effect(name){
    if(!this.unlocked||!this.context||this.context.state==='closed'||!this.foreground||!this.effects||this.volume===0)return false;
    const now=this.context.currentTime;
    if(now-(this.recent.get(name)??-Infinity)<.12)return false;
    this.recent.set(name,now);
    const at=now+.01;
    const notes=(values,spacing=.1,length=.22,level=.3)=>values.forEach((n,i)=>this._note(n,at+i*spacing,length,level));
    switch(name){
      case 'start':notes([72,76,79],.12,.3);break;
      case 'eat':notes([79,84],.075,.16);break;
      case 'jump':this._tone(260,at,.24,.28,'effect','sine',880);break;
      case 'tongue':this._tone(620,at,.13,.25,'effect','sine',180);break;
      case 'hide':notes([69,64],.09,.2,.2);break;
      case 'dive':this._tone(780,at,.32,.23,'effect','sine',130);break;
      case 'caught':notes([64,60,55],.12,.28,.24);break;
      case 'mission':notes([72,76,79,84],.12,.36,.28);break;
      case 'correct':notes([76,79,84],.1,.27);break;
      case 'retry':notes([67,64],.13,.17,.19);break;
      case 'round':notes([79,76,72],.16,.38,.24);break;
      case 'finish':notes([72,76,79,84,79,84],.16,.42,.28);break;
      default:return false;
    }
    return true;
  }
}

// Only the learner's actions make sounds. A mission chime plays once per role.
export class LearnerSound {
  constructor(audio){this.audio=audio;this.reset();}
  reset(){this.lastEvent=0;this.completedRounds=new Set();this.endedRounds=new Set();}
  observe(world,mission){
    const events=world.events.filter(e=>e.id>this.lastEvent);
    this.lastEvent=Math.max(this.lastEvent,world.serial);
    if(!['playing','between'].includes(world.phase))return;
    for(const event of events){
      if(event.prey==='me'&&event.type==='catch')this.audio.effect('caught');
      else if(event.hunter==='me'){
        if(event.type==='rice'||event.type==='catch')this.audio.effect('eat');
        else if(event.type==='skill')this.audio.effect(['jump','tongue','hide','dive'][event.role]);
      }
    }
    if(mission.complete&&!this.completedRounds.has(world.round)){
      this.completedRounds.add(world.round);this.audio.effect('mission');
    }
    if(world.phase==='between'&&!this.endedRounds.has(world.round)){
      this.endedRounds.add(world.round);this.audio.effect('round');
    }
  }
}
