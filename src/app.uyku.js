/* Uyumadan önce: today's material, said quietly, before sleep. */

/* ===================== uyku · before sleep ===================== */
/* By request, and built to what the evidence supports rather than to what
   sleep-learning videos promise. Nothing new is learned asleep. What
   sleep does do is keep what was studied in the hours before it, and
   material replayed quietly as you drift off is going over that once
   more. So:

   - **Only today's material.** The words, passage lines and grammar
     examples of units studied in the last UY_HOURS hours, the common
     words added today, and an intro lesson passed today. With nothing
     studied today it falls back to the last unit opened, and says so.
     Nothing new is ever introduced, which is the one thing a sleepy
     brain cannot take in.
   - **Turkish only, said twice, slow and getting quieter.** Each item is
     said, a pause, said again, a longer pause. The volume falls across
     the sitting, from UY_VOL[0] to UY_VOL[1].
   - **It stops by itself** after five or ten minutes, silently, so it
     does not play into deep sleep, where sound only disturbs the sleep
     doing the work. Nothing is marked and nothing is written: it adds
     no progress key and no setting.

   Engine rules as Yolda: every step is armed twice (the voice's onend
   and a watchdog) and a token lets exactly one win, and stopPlay() ends
   a sitting, so leaving the screen silences it. UY holds a run. */
const UY_MINS=[5,10];
const UY_HOURS=16;                   /* "today" is the last sixteen hours, not a calendar day */
const UY_RATE=0.8;
const UY_VOL=[0.8,0.35];
const UY_PAUSE=[2500,4500];          /* between the two sayings, then before the next item */
let UY=null;

function uyRecent(ts){return !!ts&&Date.now()-ts<UY_HOURS*3600000;}
/* A unit's own material, as far as it has been met: the words once the
   list was opened, the lines once the passage was read, the examples once
   the grammar was. The same grain the reviews use. */
function uyUnitItems(u){
  const out=[];
  if(metWords(u.id))u.vocab.forEach(function(w){out.push({tr:vocabPrimary(w[0]),en:w[1]});});
  if(metGram(u.id))u.gram.eg.forEach(function(e){out.push({tr:e[0],en:e[1]});});
  if(metLines(u.id))u.read.lines.forEach(function(l){out.push({tr:l[0],en:l[1]});});
  return out;
}
/* What to play, and what it is: {items, today, from}. */
function uyBank(){
  let items=[];
  const us=UNITS.filter(function(u){
    return (S.seen[u.id]&&uyRecent(S.seen[u.id].at))||(S.done[u.id]&&uyRecent(S.done[u.id].at));
  });
  us.forEach(function(u){items=items.concat(uyUnitItems(u));});
  BASLA.forEach(function(L){
    if(S.basla&&S.basla[L.id]&&uyRecent(S.basla[L.id].at)&&!S.basla[L.id].byTest)
      L.parts.forEach(function(pt){
        (pt.letters||[]).forEach(function(r){items.push({tr:r[1],en:r[2]});});
        (pt.rows||[]).forEach(function(r){items.push({tr:r[0],en:r[1]});});
      });
  });
  SIK.forEach(function(e){const r=S.sik&&S.sik[e[0]]; if(r&&!r.k&&r.d===dayNum())items.push({tr:e[0],en:e[1]});});
  let from=us.map(function(u){return u.lv+" · "+u.tr;});
  let today=true;
  if(!items.length){
    const last=S.place&&unit(S.place.u);
    if(last){items=uyUnitItems(last);from=[last.lv+" · "+last.tr];today=false;}
  }
  /* One of each: a word in the list and again in a line is said once. */
  const seen={};
  items=items.filter(function(it){const k=fold(it.tr); if(!k||seen[k])return false; seen[k]=1; return true;});
  return {items:items,today:today,from:from};
}

/* --- the run --------------------------------------------------------- */
function uyClear(){if(UY&&UY.tid){clearTimeout(UY.tid);UY.tid=null;}}
function uyStop(){
  if(!UY)return;
  uyClear();
  if(UY.cid){clearTimeout(UY.cid);UY.cid=null;}
  UY.tok++;
  try{if(UY.lock&&UY.lock.release){UY.lock.release();UY.lock=null;}}catch(e){}
}
function uyArm(fn,ms){
  const t=++UY.tok;
  const go=function(){
    if(!UY||UY.tok!==t)return;
    UY.tok++; uyClear(); fn();
  };
  UY.tid=setTimeout(go,ms);
  return go;
}
/* Quieter as it goes, linearly over the sitting. */
function uyVol(){
  if(!UY)return UY_VOL[0];
  const f=Math.min(1,Math.max(0,(Date.now()-UY.t0)/(UY.mins*60000)));
  return UY_VOL[0]+(UY_VOL[1]-UY_VOL[0])*f;
}
function startUyku(mins){
  stopPlay();
  const b=uyBank();
  if(!ttsOK()||!b.items.length){V={view:"uyku"};render();return;}
  UY={items:b.items,from:b.from,today:b.today,i:0,n:0,rep:0,mins:mins,t0:Date.now(),
      tok:0,tid:null,cid:null,over:false,lock:null,done:false};
  V={view:"uykurun"};window.scrollTo(0,0);touchDay();
  try{
    if(navigator.wakeLock&&navigator.wakeLock.request)
      navigator.wakeLock.request("screen").then(function(l){if(UY)UY.lock=l;},function(){});
  }catch(e){}
  /* The deadline only raises a flag: the item being said finishes. */
  UY.cid=setTimeout(function(){if(UY)UY.over=true;},mins*60000);
  uySay(0);
}
function uyItem(){return UY?UY.items[UY.i%UY.items.length]:null;}
function uySay(rep){
  if(!UY)return;
  if(UY.over){uyFinish();return;}
  const it=uyItem();
  UY.rep=rep;
  if(rep===0)UY.n++;
  render();
  const go=uyArm(function(){
    UY.tid=setTimeout(function(){
      if(!UY)return;
      if(rep===0)uySay(1);
      else{UY.i++;uySay(0);}
    },UY_PAUSE[rep]);
  },yolDur(it.tr)+4000);
  say(it.tr,UY_RATE,go,null,uyVol());
}
/* Ends in silence: a spoken "finished" is the last thing to play into
   someone falling asleep. */
function uyFinish(){
  if(!UY)return;
  uyStop();
  UY.done=true;
  render();
}

/* --- screens ---------------------------------------------------------- */
function renderUyku(){
  let h=bar("Uyumadan önce","before sleep · today, once more",true,"bugün, bir kez daha")+'<div class="wrap">';
  if(!ttsOK()){
    h+='<div class="card"><p class="lead">Ses yok</p><p class="sub">'+tx('This browser has no speech synthesis, and this mode is nothing but speech.','Bu tarayıcıda konuşma sentezi yok, bu bölüm ise baştan sona sesten ibaret.')+'</p></div></div>';
    paint(h);return;
  }
  h+=voiceNote();
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('What you studied today, said slowly and quietly in Turkish, each twice, getting quieter as it goes. It stops by itself after five or ten minutes.',
    'Bugün çalıştıkların, Türkçe olarak yavaşça ve alçak sesle, her biri iki kez; ses gittikçe kısılır. Beş ya da on dakika sonra kendiliğinden durur.')+'</p>';
  const b=uyBank();
  if(!b.items.length){
    h+='<div class="card"><p class="lead">Henüz bir şey yok</p><p class="sub">'+tx('This plays only what you have already studied, and nothing has been studied yet. Open a lesson first, and tonight it will be here.',
      'Burada yalnızca çalıştıkların çalar, henüz bir şey çalışılmadı. Önce bir ders aç; bu gece burada olacak.')+'</p></div></div>';
    paint(h);return;
  }
  h+='<div class="card"><p class="lead">'+b.items.length+' kelime ve cümle</p>'+
    '<p class="sub">'+tx(b.today?"Studied in the last "+UY_HOURS+" hours":"Nothing studied today, so this is your last lesson",
                         b.today?"Son "+UY_HOURS+" saatte çalışılanlar":"Bugün bir şey çalışılmadı; bu son dersin")+
    (b.from.length?": "+esc(b.from.join(", ")):"")+'.</p></div>';
  h+='<h2 class="sec">Başla</h2>';
  UY_MINS.forEach(function(m){
    h+='<button class="card row" onclick="startUyku('+m+')"><div class="grow">'+
     '<p class="lead">'+m+' dakika</p>'+
     '<p class="sub">'+(m===5?tx("Enough to go over today once or twice.","Bugünü bir iki kez geçmeye yeter.")
                              :tx("Longer, for a longer day. It still stops by itself.","Uzun bir gün için daha uzun. Yine kendiliğinden durur."))+'</p></div>'+
     '<span class="chev">'+IC.chev+'</span></button>';
  });
  h+='<div class="card gram"><p><b>What it can and cannot do.</b> Nothing new is learned while you are asleep. What sleep does is keep what you studied in the hours before it, and this goes over that once more while you are still awake and drifting off. So it plays only today’s material, and it stops before deep sleep, where sound would only disturb the sleep doing the work. Count it as a gentle extra, not as study time.</p>'+
    '<p><b>Keep the screen on.</b> A phone stops speaking when it locks, so the app asks to keep the screen awake for the sitting, and lets it go when it ends. Turn the brightness down and lay the phone face down.</p></div>';
  h+='</div>';
  paint(h);
}
function renderUykuRun(){
  if(!UY){renderUyku();return;}
  let h=bar("Uyumadan önce",UY.done?"Bitti":UY.mins+" dk",true)+'<div class="wrap">';
  if(UY.done){
    h+='<div class="score"><div class="big pass">'+UY.n+'</div><p class="sub">kelime ve cümle</p></div>'+
      '<div class="card"><p class="lead">İyi geceler</p><p class="sub">'+tx('That is all for tonight. Nothing was marked or scheduled.','Bu gecelik bu kadar. Hiçbir şey değerlendirilmedi ya da sıraya konmadı.')+'</p>'+
      '<button class="btn ghost" onclick="UY=null;go(\'uyku\')">Tamam</button></div></div>';
    paint(h);return;
  }
  const it=uyItem();
  /* Dim and still, and the whole screen, in either theme: a bedside
     screen, not a lesson. */
  h+='<div class="night"><p class="night-tr">'+esc(it.tr)+'</p><p class="night-en">'+esc(it.en)+'</p>'+
    '<button class="night-stop" onclick="uyFinish()">Dur</button></div></div>';
  paint(h);
}
