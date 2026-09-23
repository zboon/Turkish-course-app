/* Yolda: hands-free audio sessions. Üretim with the hands taken away —
   which turns out to be a different mode, not a setting on that one. */

/* ===================== yolda · hands-free ===================== */
/* Üretim already prompts, waits and plays the model. What it cannot do
   is run without you: every item ends in a Doğru/Yanlış tap, and a tap
   is the one thing a driver does not have. So this is a separate mode
   rather than a switch on that one.

   Three things make it Pimsleur rather than a playlist:

   1. **The English is spoken, always.** In Üretim reading the prompt is
      an option; here it is the whole input channel, so `prompten` is
      ignored and the English is always voiced — in the device's English
      voice, never the tr-TR one.
   2. **The graduated interval is inside the sitting.** The famous part
      of Pimsleur is not the pause, it is that an item comes back three
      items later, then eight, then twenty — while it is still half
      remembered. YOL_SPACING is that, in slots.
   3. **Grading is deferred, not dropped.** Self-grading is what keeps
      this app offline and microphone-free, and it cannot happen at
      sixty miles an hour. So the sitting runs untouched and the marking
      happens once, at the end, when the car is stopped: everything is
      taken as right and you tap the ones that got away. Close the app
      mid-drive and nothing is written, which is the safe direction.

   It adds **no new storage keys**. Items are the same "s:" and "k:"
   prefixes Üretim uses and grade onto the same ladder, so a sentence
   produced in the car and one produced at a desk share a box — which is
   correct, because they are the same sentence.

   YL holds a run and, like VOICE and PR, has to survive a re-render. */
const YOL_MINS=[5,10];
const YOL_SPACING=[3,8,20];          /* slots until this item returns */
/* A slot is one English prompt, the gap, and the model — five to nine
   seconds depending on the gap setting and how long the sentence is. Ten
   minutes at the shortest gap is about 128 of them, so the playlist is
   cut a little longer than the longest sitting can use. Running out
   early ends the sitting cleanly, but it ends it early, which is not
   what the learner asked for. */
const YOL_SLOTS=140;
const YGAPS=[4,5,6,8];
const YRATES=[0.9,1,1.15,1.3];
let YL=null;

function ygap(){return S.ygap||5;}
function setYgap(n){S.ygap=n;save();render();}
function yrate(){return S.yrate||1;}
function setYrate(r){S.yrate=r;save();render();}

/* The same material Üretim draws on, under the same scope rule, with
   reviews first. Sentences and prefabs together: in a car you want the
   mix, and both already key into S.prod. */
/* Sentences are scoped to units read, as everywhere else. The prefabs are
   not, and deliberately: they belong to no unit, Üretim has always
   offered them from day one, and they are the right thing to be saying
   in a car before any passage has been opened. So a fresh install gets a
   sitting of prefabs, and the sentences join in as passages are read. */
function yolBank(){
  return dueQueue(S.prod,sentenceBank().concat(chunkBank()),YOL_SLOTS);
}
/* The playlist. Each item is laid down once, then re-seeded at 3, 8 and
   20 slots on — taking the next free slot when the wanted one is busy,
   so the spacing stretches rather than collides. */
function yolQueue(bank){
  const out=new Array(YOL_SLOTS).fill(null);
  let bi=0;
  for(let s=0;s<YOL_SLOTS;s++){
    if(out[s])continue;
    if(bi>=bank.length)break;
    const it=bank[bi++];
    out[s]={it:it,rep:0};
    let at=s;
    YOL_SPACING.forEach(function(gapN,r){
      let p=at+gapN;
      while(p<YOL_SLOTS&&out[p])p++;
      if(p<YOL_SLOTS){out[p]={it:it,rep:r+1};at=p;}
    });
  }
  const q=[];
  out.forEach(function(c){if(c)q.push(c);});
  return q;
}

/* --- the run --------------------------------------------------------- */
/* Nothing here may depend on being touched, so every step is armed twice:
   the voice's own onend, and a watchdog. Some browsers drop onend, and a
   sitting you cannot tap is a sitting that cannot be rescued by tapping. */
function yolDur(t){return 1200+String(t).length*90;}
/* The STEP timer only. The deadline is not a step and must outlive every
   one of them: clearing it here made the length setting do nothing at
   all, because the first step cancelled the clock that ends the sitting. */
function yolClear(){
  if(YL&&YL.tid){clearTimeout(YL.tid);YL.tid=null;}
}
function yolDeadline(){
  if(YL&&YL.cid){clearTimeout(YL.cid);YL.cid=null;}
}
function yolStop(){
  if(!YL)return;
  yolClear();yolDeadline();
  YL.tok++;                          /* strand any callback still in flight */
  yolRelease();
}
/* Keep the screen awake for the length of the sitting. Speech synthesis
   stops with the screen on every platform this runs on, so without this
   a phone in a cradle goes quiet after thirty seconds. Wrapped, because
   the API is absent on older browsers and the mode still works there —
   the learner just has to keep the screen on themselves. */
function yolWake(){
  try{
    if(navigator.wakeLock&&navigator.wakeLock.request)
      navigator.wakeLock.request("screen").then(function(l){if(YL)YL.lock=l;},function(){});
  }catch(e){}
}
function yolRelease(){
  try{ if(YL&&YL.lock&&YL.lock.release){YL.lock.release();YL.lock=null;} }catch(e){}
}
/* Arm one step. Whichever fires first wins and the other is stranded by
   the token, so a step can never advance twice. */
function yolArm(fn,ms){
  const t=++YL.tok;
  const go=function(){
    if(!YL||YL.tok!==t)return;
    YL.tok++; yolClear(); fn();
  };
  YL.tid=setTimeout(go,ms);
  return go;
}
function startYolda(mins){
  stopPlay();
  if(!ttsOK()){V={view:"yolda"};render();return;}
  const q=yolQueue(yolBank());
  if(!q.length){V={view:"yolda"};render();return;}
  YL={q:q,i:0,mins:mins,phase:"en",tok:0,tid:null,cid:null,left:ygap(),
      over:false,lock:null,missed:{},done:false};
  V={view:"yoldarun"};window.scrollTo(0,0);
  touchDay();yolWake();
  /* The deadline is one timer, and it only raises a flag: cutting the
     audio mid-sentence to hit 5:00 exactly would be worse than running
     eight seconds over. */
  YL.cid=setTimeout(function(){if(YL)YL.over=true;},mins*60000);
  render();yolSay();
}
function yolItem(){const c=YL&&YL.q[YL.i];return c?c.it:null;}
function yolSay(){
  if(!YL)return;
  const it=yolItem();
  if(!it){yolFinish();return;}
  YL.phase="en";render();
  const go=yolArm(yolGap,yolDur(it.en)+4000);
  say(it.en,0.95,go,"en-GB");
}
function yolGap(){
  if(!YL)return;
  YL.phase="gap";YL.left=ygap();render();
  yolCount();
}
function yolCount(){
  if(!YL||YL.phase!=="gap")return;
  const el=document.getElementById("ycount");
  if(el)el.textContent=YL.left;
  if(YL.left<=0){yolModel();return;}
  YL.tid=setTimeout(function(){
    if(!YL||YL.phase!=="gap")return;
    YL.left--;yolCount();
  },1000);
}
function yolModel(){
  if(!YL)return;
  const it=yolItem();
  if(!it){yolFinish();return;}
  YL.phase="tr";render();
  const go=yolArm(yolNext,yolDur(it.tr)+4000);
  say(it.tr,yrate(),go);
}
function yolNext(){
  if(!YL)return;
  const it=yolItem();
  if(it&&!YL.missed.hasOwnProperty(it.k))YL.missed[it.k]=false;
  YL.i++;
  if(YL.over||YL.i>=YL.q.length){yolFinish();return;}
  /* A beat between items, so two sentences do not run together. */
  YL.tid=setTimeout(function(){if(YL)yolSay();},700);
}
function yolFinish(){
  if(!YL)return;
  yolClear();yolDeadline();yolRelease();
  YL.phase="end";YL.done=true;
  window.scrollTo(0,0);render();
  /* Say so, because the learner is not looking at the screen. */
  say("Session finished.",0.95,null,"en-GB");
}
/* --- the marking, once the car has stopped --------------------------- */
function yolCovered(){
  if(!YL)return [];
  const seen={}, out=[];
  YL.q.slice(0,YL.i).forEach(function(c){
    if(seen[c.it.k])return;
    seen[c.it.k]=1;out.push(c.it);
  });
  return out;
}
function yolMiss(k){
  if(!YL)return;
  YL.missed[k]=!YL.missed[k];
  render();
}
function yolSave(){
  if(!YL)return;
  /* Everything covered is taken as produced unless the learner says
     otherwise. Nothing was written during the drive, so abandoning a
     sitting costs nothing rather than inflating a box. */
  yolCovered().forEach(function(it){
    const miss=!!YL.missed[it.k];
    prodGradeKey(it.k,!miss);
    if(miss)errNote(it.k,{m:"s",q:it.en,c:it.tr,to:errUnitOf(it.k)});
  });
  YL=null;go("yolda");
}

/* --- screens ---------------------------------------------------------- */
function renderYolda(){
  const bank=yolBank();
  let h=bar("Yolda","hands-free · eyes up",true)+'<div class="wrap">';
  if(!ttsOK()){
    h+='<div class="card"><p class="lead">Ses yok</p><p class="sub">This browser has no speech synthesis, and this mode is nothing but speech.</p></div></div>';
    app().innerHTML=h;return;
  }
  h+=voiceNote();
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">A sitting that runs without you: the English is spoken, you answer out loud into the silence, then the Turkish comes. Nothing to tap until it ends, so it can be done while driving or working. Items come back three, eight and twenty slots later — inside the same sitting, while they are still half remembered.</p>';
  if(!bank.length){
    h+='<div class="card"><p class="lead">Bugünlük bitti</p>'+
     '<p class="sub">Every sentence and prefab is scheduled far enough ahead that none is due today.</p>'+
     '<button class="btn" onclick="home()">Bugüne dön</button></div></div>';
    app().innerHTML=h;return;
  }
  const sents=sentenceBank().length;
  h+='<div class="stat"><div><b>'+sents+'</b><span>cümle</span></div>'+
     '<div><b>'+CHUNKS.length+'</b><span>kalıp</span></div>'+
     '<div><b>'+yrate()+'×</b><span>hız</span></div></div>';
  if(!sents)h+='<p class="tiny" style="margin:.1rem .2rem .6rem">Prefabs only so far. They belong to no unit, so they are ready on day one; a unit’s own sentences join in once you have read its passage.</p>';

  h+='<h2 class="sec">Başla</h2>';
  YOL_MINS.forEach(function(m){
    h+='<button class="card row" onclick="startYolda('+m+')"><div class="grow">'+
     '<p class="lead">'+m+' dakika</p>'+
     '<p class="sub">'+(m===5?"A short one — a commute, or the walk to the shop."
                              :"Long enough to get past the first few and into the ones that come back.")+'</p></div>'+
     '<span class="chev">'+IC.chev+'</span></button>';
  });

  h+='<h2 class="sec">Ayarlar</h2><div class="card">';
  h+='<p class="lead" style="font-size:.95rem">Sessizlik · the gap</p>'+
   '<p class="sub">Longer than Üretim’s, because nobody is waiting for your thumb.</p><div class="segs">';
  YGAPS.forEach(function(n){h+='<button class="'+(n===ygap()?"on":"")+'" onclick="setYgap('+n+')">'+n+'<i>saniye</i></button>';});
  h+='</div>';
  h+='<p class="lead" style="font-size:.95rem">Hız · the model’s speed</p>'+
   '<p class="sub">1× is where the voice sits naturally. Below it is a crutch you will not get in a conversation.</p><div class="segs">';
  YRATES.forEach(function(r){
    h+='<button class="'+(Math.abs(r-yrate())<0.01?"on":"")+'" onclick="setYrate('+r+')">'+r+'×'+
     (r>1?'<i>hızlı</i>':r===1?'<i>normal</i>':'<i>yavaş</i>')+'</button>';
  });
  h+='</div></div>';

  h+='<p class="foot">Keep the screen on: speech stops when a phone locks, so the app asks to hold the screen awake and that is all it can do about it.<br>Marking happens once, at the end — nothing is written while you drive.</p></div>';
  app().innerHTML=h;
}

function renderYoldaRun(){
  if(!YL){renderYolda();return;}
  if(YL.phase==="end"){
    const cov=yolCovered(), miss=cov.filter(function(it){return YL.missed[it.k];}).length;
    let h=bar("Yolda","Bitti",true)+'<div class="wrap"><div class="score">'+
      '<div class="big pass">'+cov.length+'</div><p class="sub">cümle geçildi · covered</p></div>';
    h+='<div class="card"><p class="sub">Everything here is taken as produced. Tap the ones that got away — those come back today, the rest move out a box. Nothing has been written yet.</p></div>';
    h+='<div class="card" style="padding:.3rem 1rem">';
    cov.forEach(function(it){
      const bad=!!YL.missed[it.k];
      h+='<button class="unit" onclick="yolMiss(\''+jsq(it.k)+'\')">'+
        '<span class="tick '+(bad?"":"done")+'">'+(bad?"·":IC.check)+'</span>'+
        '<span class="grow"><span class="unit-t">'+esc(it.tr)+'</span>'+
        '<span class="unit-s">'+esc(it.en)+'</span></span></button>';
    });
    h+='</div>';
    h+='<button class="btn" onclick="yolSave()">Kaydet'+(miss?" · "+miss+" kaçtı":"")+'</button>';
    h+='<button class="btn ghost" onclick="YL=null;go(\'yolda\')">Kaydetmeden çık</button></div>';
    app().innerHTML=h;
    return;
  }
  const c=YL.q[YL.i], it=c&&c.it;
  if(!it){renderYolda();return;}
  /* Glanceable, not readable: one thing at a time, as large as it goes.
     Whatever is on screen here is being read at a traffic light, if at
     all, so the run carries no controls but the one that stops it. */
  let h=bar("Yolda",(YL.i+1)+" / "+YL.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+YL.q.map(function(_,i){
    return '<i class="'+(i<YL.i?"ok":"")+'"></i>';
  }).join('')+'</div>';
  h+='<p class="qn">'+(c.rep?"Yine · again ("+(c.rep+1)+")":"Yeni · new")+' · '+YL.mins+' dk</p>';
  h+='<div class="card" style="text-align:center;padding:2rem 1rem;min-height:210px">'+
   '<p style="font-size:1.25rem;line-height:1.4;margin:0;font-weight:600">'+esc(it.en)+'</p>';
  if(YL.phase==="gap"){
    h+='<p class="mark" id="ycount" style="font-size:3.4rem;margin:.7rem 0 .1rem;color:var(--turk)">'+YL.left+'</p>'+
     '<p class="tiny">Şimdi yüksek sesle · out loud now</p>';
  }else if(YL.phase==="tr"){
    h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.7rem;line-height:1.35;margin:.9rem 0 0">'+esc(it.tr)+'</p>';
  }else{
    h+='<p class="tiny" style="margin-top:1.4rem">dinle · listen</p>';
  }
  h+='</div>';
  h+='<p class="tiny" style="text-align:center">'+esc(it.lv+" · "+it.from)+'</p>';
  h+='<button class="btn ghost" onclick="yolFinish()">Bitir · stop and mark</button></div>';
  app().innerHTML=h;
}
