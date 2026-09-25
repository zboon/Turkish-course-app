/* Core: saved state, the small helpers every screen uses, the voice
   player, the spaced-repetition ladder, and routing. Nothing here
   draws a screen. */

/* ===================== app ===================== */
const APP_VERSION="v3.73";

/* ===================== storage ===================== */
const KEY="turkce-course-v1";
let S={done:{},seen:{},place:null,star:[],tested:{},days:[],theme:null,srs:{},rate:0.85,
       prod:{},retell:{},gap:4,prompten:false,pscope:"done",
       dinle:{},drate:1,dreplay:2,rep:{},gram:{},ygap:5,yrate:1,err:{},mine:[],
       num:{},nmax:999,ncap:5,dia:{},ata:{},sik:{},coz:{},ada:{n:0,s:[]},log:{n:0,e:[],src:[]},tips:true};
/* Progress lives in this browser and nowhere else, so a save that fails is
   the one silent bug that costs a learner months: every box, every star,
   gone when the tab closes, and nothing said. It used to be swallowed.
   Now it raises a strip in the top bar of every screen until a save goes
   through again. A browser that accepts the write and discards it later
   (a private window) cannot be told apart from one that keeps it, so this
   claims only what it can see. */
let SAVEFAIL=false;
function load(){
  try{const r=localStorage.getItem(KEY); if(r){const o=JSON.parse(r); if(o&&typeof o==="object") S=Object.assign(S,o);}}
  catch(e){SAVEFAIL=true;}
  if(!S.done)S.done={}; if(!S.seen)S.seen={}; if(!S.star)S.star=[]; if(!S.tested)S.tested={}; if(!S.days)S.days=[]; if(!S.srs)S.srs={};
  if(!S.prod)S.prod={}; if(!S.retell)S.retell={}; if(!S.dinle)S.dinle={}; if(!S.rep)S.rep={};
  /* S.gram is the grammar schedule, keyed by unit id — not a unit's own
     gram: block. S.num is keyed by the shape of a number, not a number. */
  if(!S.gram)S.gram={}; if(!S.err)S.err={}; if(!S.mine)S.mine=[]; if(!S.num)S.num={}; if(!S.dia)S.dia={};
  /* S.ata is keyed by a saying's slug — "a:<id>"/"d:<id>" — not by a position. */
  if(!S.ata)S.ata={};
  /* S.sik is keyed by the word itself, never its place in SIK. */
  if(!S.sik)S.sik={};
  /* S.basla is keyed by intro lesson id, as permanent as a unit id. */
  if(!S.basla)S.basla={};
  /* S.coz is keyed by an ending ("fut", "loc"), never by a word. */
  if(!S.coz)S.coz={};
  /* S.ada.s is the learner's own sentences, keyed by a counter. */
  if(!S.ada||!S.ada.s)S.ada={n:0,s:[]};
  /* S.log is the outside-input record: entries and sources, keyed by a counter. */
  if(!S.log||!S.log.e)S.log={n:0,e:[],src:[]};
}
function save(){ try{localStorage.setItem(KEY,JSON.stringify(S));SAVEFAIL=false;}catch(e){SAVEFAIL=true;} }
function saveWarn(){
  if(!SAVEFAIL)return "";
  return '<div class="savewarn"><div class="savewarn-in"><span class="grow"><b>Kaydedilmiyor</b> · '+tx('this browser is not saving your progress. What you do now is lost when the page closes.','bu tarayıcı ilerlemeni kaydetmiyor. Şimdi yaptıkların sayfa kapanınca kaybolur.')+'</span>'+
    '<button onclick="saveHelp()">Yedekle</button></div></div>';
}
function saveHelp(){
  go("about");
  const e=document.getElementById("yedek");
  if(e)try{e.scrollIntoView({block:"start"});}catch(x){}
}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function touchDay(){const t=today(); if(S.days[S.days.length-1]!==t){S.days.push(t); if(S.days.length>400)S.days=S.days.slice(-400); save();}}
function streak(){
  if(!S.days.length)return 0;
  const set=new Set(S.days), d=new Date();
  const key=x=>x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  if(!set.has(key(d)))d.setDate(d.getDate()-1);
  let n=0;
  while(set.has(key(d))&&n<400){n++;d.setDate(d.getDate()-1);}
  return n;
}

/* ===================== helpers ===================== */
const app=()=>document.getElementById("app");
/* Nothing reviews material the learner has not met. A review of something
   never seen is not a review — it is a test in a language not yet taught,
   and getting it wrong handed a day-one learner C2 vocabulary to recall.
   The grain matters too: opening a unit's word list is not reading its
   passage, so the words become reviewable and the sentences do not.
     metWords  — the ten vocabulary entries are in play
     metLines  — the passage has been read, so its sentences are in play
     isMet     — the unit has been opened at all */
function seenSec(id,sec){return !!(S.seen&&S.seen[id]&&S.seen[id][sec]);}
function metWords(id){return isDone(id)||seenSec(id,"v");}
function metLines(id){return isDone(id)||seenSec(id,"r");}
function isMet(id){return !!(S.seen&&S.seen[id])||isDone(id);}
function metUnits(){return UNITS.filter(u=>isMet(u.id));}
function unitsOf(lv){return UNITS.filter(u=>u.lv===lv);}
function unit(id){return UNITS.find(u=>u.id===id);}
function isDone(id){return !!S.done[id];}
function lvDone(lv){return unitsOf(lv).filter(u=>isDone(u.id)).length;}
function lvPct(lv){const a=unitsOf(lv);return a.length?Math.round(100*lvDone(lv)/a.length):0;}
function allPct(){return Math.round(100*UNITS.filter(u=>isDone(u.id)).length/UNITS.length);}
function currentLevel(){for(const l of LEVELS){if(lvPct(l.id)<100)return l.id;}return "C2";}
function nextUnit(){for(const u of UNITS){if(!isDone(u.id))return u;}return null;}
/* A new lesson a day. Reported by the learner: two A2 units took an
   afternoon, so the whole level could be ticked in a day, and a unit
   passed on a quiz minutes after the lesson is a unit followed, not one
   kept. The first answer was a unit a day; the second, asked for after
   comparing it with Pimsleur's month a level, is that a unit is three
   lessons (Derse başla, app.adim.js) and the plan offers one of them a
   day, so a level of ten units is about a month. It is the plan's pace,
   not a lock: every lesson can be opened by hand from the unit page.

   S.ders[unitId] is [d1,d2,d3], the day each lesson was FIRST finished
   (0 while it is not), so a lesson gone over again keeps its day.

   A unit counts on the day it was FIRST passed (done.first, set once by
   the unit quiz); a unit passed again keeps its day, and a level test
   writes no `first` at all. Records from before this have none either
   and count as old. Passing a unit whose third lesson is done is the end
   of that lesson rather than new work, so it is not counted twice. */
const LESSONS=3, LESSON_DAY=1;
function dersOf(id){return (S.ders&&S.ders[id])||[0,0,0];}
/* The next lesson of a unit, 0–2, or 3 once all three are finished and
   only its exercises are left. */
function dersNext(id){const d=dersOf(id);for(let k=0;k<LESSONS;k++)if(!d[k])return k;return LESSONS;}
function dersMark(id,k){
  if(!S.ders)S.ders={};
  const d=dersOf(id).slice(); if(d[k])return;
  d[k]=dayNum(); S.ders[id]=d; save();
}
function dersCount(){let n=0;for(const id in (S.ders||{}))n+=S.ders[id].filter(Boolean).length;return n;}
function lessonsNewToday(){
  const n=dayNum();
  let c=0;
  for(const id in (S.ders||{}))c+=S.ders[id].filter(function(d){return d===n;}).length;
  UNITS.forEach(function(u){const d=S.done[u.id];if(d&&d.first===n&&!dersOf(u.id)[LESSONS-1])c++;});
  return c;
}
function dayFull(){return lessonsNewToday()>=LESSON_DAY;}
/* The course opens in order: the six lessons of Başlarken one after
   another, then each unit once the one before it is passed. A level's
   test ahead passes every unit in it, so it is the way to skip, as in
   any course that locks its path. Nothing already opened or passed is
   ever locked again: a learner's progress is never taken away. */
function introDone(){return BASLA.every(function(l){return baslaDone(l.id);});}
function unitOpen(id){
  const i=UNITS.findIndex(function(u){return u.id===id;});
  if(i<0)return false;
  if(isMet(id))return true;
  return i===0?introDone():isDone(UNITS[i-1].id);
}
/* What opens a locked unit: the unit before it, or the intro. */
function unitKey(id){
  const i=UNITS.findIndex(function(u){return u.id===id;});
  return i>0?UNITS[i-1]:null;
}
function baslaOpen(id){
  const i=baslaIdx(id);
  return i<=0||baslaDone(id)||baslaDone(BASLA[i-1].id);
}

/* Inline onclick handlers carry word text, so it has to survive being
   pasted into a JS string literal inside an HTML attribute. */
function jsq(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");}

const IC={
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
 lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
 caret:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
 chev:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
 spk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
 play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l12 8-12 8z"/></svg>',
 stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"/></svg>'
};


/* Two controls appear beside a word wherever a word is listed — the
   speaker and the star. Built here so the five lists cannot drift. */
function spkBtn(text,o){
  o=o||{};
  return '<button class="sbtn"'+(o.style?' style="'+o.style+'"':'')+
    ' onclick="'+(o.stop?"event.stopPropagation();":"")+'sayWord(\''+jsq(text)+'\')"'+
    (o.aria?' aria-label="'+o.aria+'"':'')+'>'+IC.spk+(o.text||"")+'</button>';
}
function starBtn(on,click,aria){
  return '<button class="star '+(on?"on":"")+'" onclick="'+click+'" aria-label="'+aria+'">'+IC.star+'</button>';
}

/* ===================== arma · the crest ===================== */
/* The İznik rosette the app is named by: eight rumi petals round a hatayi
   centre, inside a gold band. It is drawn in three places — src/icon.svg
   with the colours baked in, because an icon has no stylesheet; that file
   inlined as the favicon, so the single published page carries its own
   icon; and here. This copy fills from --crest-*, which deliberately sit
   outside the light and dark palettes: a crest is a painted object, and
   inverting it turns glazed tile into pastel. The petals are emitted in a
   loop rather than with <use> because two crests on one screen would
   collide on the same element ids. validate.js checks that all three
   still draw the same figure in the same colours. */
const PETAL_OUT="M0 -172C40 -126 48 -86 0 -48C-48 -86-40 -126 0 -172Z";
const PETAL_IN="M0 -150C24 -118 28 -92 0 -66C-28 -92-24 -118 0 -150Z";
function petals(d,fill){
  let s="";
  for(let i=0;i<8;i++) s+='<path d="'+d+'" fill="'+fill+'" transform="rotate('+(i*45)+')"/>';
  return s;
}
function crest(px){
  return '<svg class="crest" width="'+px+'" height="'+px+'" viewBox="0 0 512 512" '+
    'aria-hidden="true" focusable="false"><g transform="translate(256 256)">'+
    '<circle r="212" fill="var(--crest-ground)"/>'+
    '<circle r="193" fill="none" stroke="var(--crest-band)" stroke-width="7"/>'+
    petals(PETAL_OUT,"var(--crest-petal)")+petals(PETAL_IN,"var(--crest-inner)")+
    '<circle r="56" fill="var(--crest-heart)"/><circle r="34" fill="var(--crest-band)"/>'+
    '<circle r="14" fill="var(--crest-inner)"/></g></svg>';
}

/* ===================== voice ===================== */
function voiceNoteInner(){
  const st=voiceState();
  if(st==="notr")return '<div class="card vnote"><p class="lead">Türkçe ses yok · no Turkish voice</p>'+
    '<p class="sub">'+tx('This device can speak but has no Turkish voice, so Turkish is read in another language’s voice with the wrong sounds. Treat what you hear as a rough guide, not a model to copy, until one is added.',
      'Bu cihaz konuşabiliyor ama Türkçe sesi yok; Türkçe başka bir dilin sesiyle, yanlış seslerle okunur. Türkçe bir ses eklenene kadar duyduğunu taklit edilecek bir örnek değil, kaba bir yol gösterici say.')+'</p>'+
    '<button class="btn ghost" onclick="voiceHelp()">Nasıl eklenir · how to add one</button></div>';
  if(st==="none")return '<div class="card vnote"><p class="lead">Ses yok · no speech</p>'+
    '<p class="sub">'+tx('This browser cannot speak, so nothing will be read aloud. Everything else works.','Bu tarayıcı konuşamıyor; hiçbir şey sesli okunmayacak. Geri kalan her şey çalışır.')+'</p></div>';
  return "";
}
/* Wrapped in #vnote so a voice list that arrives after the paint can fill
   it in place — poked, not re-rendered, because a re-render would empty
   whatever the learner had typed on the screen. */
function voiceNote(){return '<div id="vnote">'+voiceNoteInner()+'</div>';}
function voiceHelp(){
  go("about");
  const e=document.getElementById("ses");
  if(e)try{e.scrollIntoView({block:"start"});}catch(x){}
}
if(ttsOK()){try{
  speechSynthesis.onvoiceschanged=function(){
    VOICE.ready=true;
    const e=document.getElementById("vnote"); if(e)e.innerHTML=enUnder(voiceNoteInner());
  };
  speechSynthesis.getVoices();   /* Chrome loads the list lazily, on first ask */
}catch(e){}}
function sayLine(i){
  stopPlay();
  const u=unit(V.u); if(!u)return;
  hilite(i,true); say(u.read.lines[i][0]);
}
function sayWord(t){stopPlay();say(t,0.8);}
function hilite(i,once){
  const box=document.getElementById("passage"); if(!box)return;
  const all=box.querySelectorAll(".ln");
  for(let k=0;k<all.length;k++)all[k].classList.remove("now");
  const el=document.getElementById("ln"+i);
  if(el){el.classList.add("now"); if(!once)try{el.scrollIntoView({block:"center",behavior:"smooth"});}catch(e){}}
}
function vstat(t){const e=document.getElementById("vstat"); if(e)e.textContent=t;}
function playFrom(i,mode){
  stopPlay();
  if(!ttsOK()){vstat("Bu tarayıcıda ses yok · no speech on this browser");return;}
  VOICE.mode=mode; VOICE.idx=i||0; markMode(); stepPlay();
}
function stepPlay(){
  const u=unit(V.u); if(!u||!VOICE.mode)return stopPlay();
  const lines=u.read.lines;
  if(VOICE.idx>=lines.length){vstat("Bitti · finished");return stopPlay();}
  const i=VOICE.idx, t0=Date.now();
  hilite(i);
  vstat((VOICE.mode==="shadow"?"Gölge · ":"Dinle · ")+(i+1)+"/"+lines.length);
  const ok=say(lines[i][0],VOICE.rate,function(){
    if(!VOICE.mode)return;
    const dur=Math.max(700,Date.now()-t0);
    if(VOICE.mode==="shadow")vstat("Şimdi sen · your turn ("+(i+1)+"/"+lines.length+")");
    const gap=VOICE.mode==="shadow"?dur+500:300;
    VOICE.tid=setTimeout(function(){if(!VOICE.mode)return;VOICE.idx++;stepPlay();},gap);
  });
  if(!ok)stopPlay();
}
function stopPlay(){
  VOICE.mode=null;
  if(VOICE.tid){clearTimeout(VOICE.tid);VOICE.tid=null;}
  prodStop();                    /* the Üretim gap is a timer too */
  dinleStop();                   /* and the Dinleme replay timer */
  yolStop();                     /* and a hands-free sitting, which is all timers */
  uyStop();                      /* and a before-sleep sitting, likewise */
  if(ttsOK()){try{speechSynthesis.cancel();}catch(e){}}
  markMode();
}
function markMode(){
  ["btn-listen","btn-shadow"].forEach(function(id){
    const b=document.getElementById(id); if(!b)return;
    const on=(id==="btn-listen"&&VOICE.mode==="listen")||(id==="btn-shadow"&&VOICE.mode==="shadow");
    b.classList.toggle("on",on);
  });
  if(!VOICE.mode)vstat("");
}
/* The study rates and the ones past normal. 1x is where a TTS voice
   sits naturally, so everything below it is a crutch and everything above
   it is the training: real speech is faster than the pace you can read at,
   and comprehension that only works at 0.85 is comprehension that fails in
   a conversation. Rendered as two rows, slow then fast. */
const SPEEDS=[[0.6,0.75,0.85,1],[1.15,1.3,1.5,1.75]];
function setRate(r){VOICE.rate=r;S.rate=r;save();const m=VOICE.mode,i=VOICE.idx;stopPlay();
  document.querySelectorAll(".spd").forEach(function(b){b.classList.toggle("on",Math.abs(parseFloat(b.dataset.r)-r)<0.01);});
  if(m)playFrom(i,m);}

/* ===================== review queue (SRS) ===================== */
function srsAdd(k){if(!S.srs)S.srs={};if(!S.srs[k])S.srs[k]={b:0,d:dayNum()};}
function srsDrop(k){if(S.srs)delete S.srs[k];}
function dueList(){
  if(!S.srs)S.srs={};
  return S.star.filter(function(k){return isDue(S.srs,k);});
}
function grade(k,g){
  if(!S.srs)S.srs={};
  bump(S.srs,k,function(b){return g===0?0:g===1?b+1:b+2;});
  save();
}

/* The starred list and the schedule are two halves of one fact, and
   CLAUDE.md's rule is that they never drift apart — so every caller goes
   through these rather than touching S.star directly. */
/* Reviews first, oldest due first; the rest of the sitting is filled with
   items never seen before, in course order, so a mode walks the material
   rather than sampling it at random. Üretim and Dinleme keep separate
   schedules — the same sentence can be easy to recognise and hard to
   produce — so the map is passed in rather than assumed. */
/* New items per day, per review queue. Reviews of what has been practised
   come due without limit; what has never been practised is let in only so
   fast. Without it, meeting many units at once — a level test passes ten —
   put a hundred words "due" in Tekrar at once, and the plan, which puts
   reviews before new material, asked for ten after ten after ten and never
   reached the next unit. A learner reported exactly that. Counted from the
   f stamp bump() puts on a record the day it is created; records from
   before the stamp existed count as old, which only errs toward one more
   sitting on the day this shipped. */
const NEW_DAY={rep:10,gram:3,dinle:8,prod:12};

function starKey(tr,en){return tr+"|"+en;}
function isStarred(tr,en){return S.star.indexOf(starKey(tr,en))>-1;}
function addStar(k){if(S.star.indexOf(k)<0){S.star.push(k);srsAdd(k);}}
function dropStar(k){const at=S.star.indexOf(k);if(at>-1){S.star.splice(at,1);srsDrop(k);}}
function setStar(tr,en,on){const k=starKey(tr,en);if(on)addStar(k);else dropStar(k);}
/* ===================== routing ===================== */
let V={view:"home"};
let Q=null;
function go(view,a,b){stopPlay();V={view:view,lv:a,u:a,sec:b}; if(view==="unit")V={view:"unit",u:a,sec:b||"v"}; window.scrollTo(0,0); render();}
function home(){stopPlay();V={view:"home"};window.scrollTo(0,0);render();}
/* The tool screens all hang off Araçlar; Dersler holds the levels. */
const HUBV=["prod","dinle","tekrar","gram","yolda","hata","mine","sor",
            "sayilar","diyalog","ata","words","dict","about","nasil","sik","uyku","coz","ada","gunluk","okuma"];
/* İlerleme is reached from the home screen, so back() from it goes home. */
function back(){
  if(V.view==="unit"){go("level",unit(V.u).lv);}
  else if(V.view==="quiz"&&Q&&Q.mode==="unit"){go("unit",Q.u,"d");}
  else if(V.view==="quiz"&&Q&&Q.mode==="level"){go("level",Q.lv);}
  else if(V.view==="quiz"&&Q&&Q.mode==="intro"){go("basla",Q.b);}
  else if(V.view==="quiz"&&Q&&Q.mode==="introtest"){go("baslarken");}
  else if(V.view==="basla"){go("baslarken");}
  else if(V.view==="baslarken"){go("dersler");}
  else if(V.view==="prodrun"){go(PR&&PR.mode==="i"?"ada":"prod");}
  else if(V.view==="adaisl"||V.view==="adakontrol"){adaGo("ada");}
  else if(V.view==="okumaoku"){go("okuma");}
  else if(V.view==="dinlerun"){go("dinle");}
  else if(V.view==="tekrarrun"){go("tekrar");}
  else if(V.view==="gramrun"){go("gram");}
  else if(V.view==="cozrun"){CZ=null;go("coz");}
  /* Leaving a sitting mid-drive should not throw away what was covered:
     the back arrow and the Bitir button do the same thing, which is what
     a learner expects of a mode whose whole point is not touching it. */
  else if(V.view==="uykurun"){uyStop();UY=null;go("uyku");}
  else if(V.view==="adim"){go("unit",AD?AD.u:V.u,"v");}
  else if(V.view==="yoldarun"){if(YL&&YL.phase!=="end")yolFinish();else{YL=null;go("yolda");}}
  else if(V.view==="retell"||V.view==="retelldone"){go("unit",V.u,"r");}
  /* The back arrow retraces the menu you came through. Before the two
     doors existed every screen fell through to home(), which was right
     when home() WAS the menu; now it would skip the hub and make the
     doors feel like a detour rather than a place. */
  else if(V.view==="level"){go("dersler");}
  else if(V.view==="cards"||V.view==="review"){go("words");}
  else if(HUBV.indexOf(V.view)>=0){go("araclar");}
  else home();
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute("data-theme");
  const dark=cur?cur==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme",dark?"light":"dark");
  S.theme=dark?"light":"dark"; save(); render();
}
function themeIcon(){
  const cur=document.documentElement.getAttribute("data-theme");
  const dark=cur?cur==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark?IC.sun:IC.moon;
}
/* ===================== İngilizcesi · English under the Turkish ===================== */
/* The interface is Turkish, which is right for the learner the course is
   making and hard on the one it starts with: Başla, Devam and Kontrol et
   mean nothing on day one. Until A2 is complete every instruction carries
   its English underneath, small and faint, and the EN button in the top
   bar turns it off or back on. The learner's choice is stored (S.en); with
   no choice made it follows the level, the same line tipsOn() uses.

   It is one table and one pass, not markup at every call site: paint()
   runs each screen through enUnder() on its way to the page, and the pass
   touches only the first run of text inside an interface element (a
   button, a section heading, a prompt, a lead line), and only when that
   text is a key below. Course content never matches because it is never
   looked up — a passage word that happened to equal a key would have to
   sit in one of those elements to be glossed, and passages do not. The
   English always goes into the page; the toggle is a class on <html>, so
   switching it redraws nothing and cannot lose a half-typed answer.

   Two kinds of label. A bare Turkish one (Başla) is looked up in EN_UI.
   One already written "Türkçe · english" keeps its Turkish and has the
   English moved underneath, but only when the English half is listed in
   EN_INLINE — the half after a · is sometimes Turkish (bu oturum) or
   content (a vocabulary gloss), and guessing which is how a vocabulary
   answer would vanish when the toggle is off. sim.js fails on an
   interface label with an unlisted English half, so a new one gets
   decided rather than left to chance. */
const EN_UI={
 "Başla":"start","Devam":"continue","Kontrol et":"check","Sonuç":"see the result","Tekrar dene":"try again",
 "Sonraki":"next","Sonraki ünite →":"next unit","Sonraki ders →":"next lesson","Önce sen söyle":"say it first","Sık kelimeler":"common words","Tekrara ekle":"add to my reviews","Konuş":"speak","Şimdi değil":"not now","Kilitli":"locked","Derse başla":"start the lesson","Sınava gir":"take the test","Dersi tekrarla":"go over the lesson again","Türkçesini yaz":"type the Turkish","Sen de dene":"now you try","Metni göster":"show the text","Yeni kelime":"new word","Ne duydun?":"what did you hear?","Harfleri diz":"spell it","İngilizcesi":"show the English","Alıştırmalara hazırsın":"ready for the exercises","Dur":"stop","Tamam":"okay","İyi geceler":"good night","Henüz bir şey yok":"nothing yet","kelime ve cümle":"words and sentences","Uyumadan önce":"before sleep","Giriş sınavı":"intro test","Giriş dersleri":"the lessons before unit one","Giriş derslerine başla":"start the lessons before unit one","Derse dön":"back to the lesson","Bir daha dinle":"listen again","Sonraki parça":"next piece","Bitir":"finish","Baştan":"start over",
 "İlerleme":"progress","Bir oturum daha":"one more sitting","Hatalar":"mistakes","Hata defterini aç":"open the mistake book",
 "Seviyeye dön":"back to the level","Üniteye dön":"back to the unit","Bugüne dön":"back to today","Ana sayfa":"home",
 "Dilbilgisine geç →":"on to the grammar","Okumaya geç →":"on to the reading","Alıştırmalara geç →":"on to the exercises",
 "Tüm kelimeleri tekrara ekle":"add all the words to my reviews","Tümü listede ✓":"all on my list",
 "Tekrara başla":"start reviewing","Kartlarla çalış":"study with flashcards","Çevir":"turn the card",
 "Göster":"show","Şimdi göster":"show it now","Zor":"hard","İyi":"good","Kolay":"easy","Doğru":"right","Yanlış":"wrong",
 "İngilizceyi de seslendir":"read the English aloud too","Sondan başa kur":"build it from the end",
 "Anlattım":"I told it","Yine de anlattım":"I told it anyway","Anladım":"I understood","Anlamadım":"I didn’t understand",
 "Bir daha":"once more","Vazgeç":"cancel","Kaydet":"save","Kaydetmeden çık":"leave without saving",
 "Hepsini sil":"delete them all","Ekle ve tekrara al":"add it and review it","Yedeği al":"download a backup",
 "Geri yükle":"restore a backup","Tüm ilerlemeyi sil":"delete all progress","Yedekle":"back up","Sıfırla":"reset",
 "Defteri temizle":"clear the book",
 /* tabs, filters and settings */
 "Kelimeler":"words","Dilbilgisi":"grammar","Okuma":"reading","Alıştırma":"exercises",
 "Bu ünite":"this unit","Tümü":"all","Tamamlanan":"finished","Ders":"course","Çekirdek":"core","Benim":"mine",
 "İsim":"noun","Fiil":"verb","Sıfat":"adjective","Zarf":"adverb","Edat":"postposition","İfade":"expression",
 "seviyeye göre":"by level","üniteye git":"go to the unit","artık biliyorum ×":"I know it now","düzenle":"edit","biliyorum":"I know it",
 /* the modes, where a name is also an instruction */
 "Üretim":"production","Dinleme":"listening","Diyalog":"conversation","Tekrar":"again","Tekrar motoru":"repetition engine",
 "Kendi kelimelerim":"my own words","Sözlüğüm":"my saved words","Atasözleri ve deyimler":"proverbs and idioms",
 "Kurma ve Dönüştürme":"build and change",
 /* section headings */
 "Bugün":"today","Çalış":"study","Ayarlar":"settings","Konular":"topics","Seviyeler":"levels","Başlarken":"getting started",
 "Kurs":"the course","Konuşma":"speaking","Sözlük":"dictionary","İleri test":"test ahead","Üç kez anlat":"say it three times",
 "Karşılaşma sayısı":"times met","Nerede zayıfsın":"where you are weak","Son hatalar":"recent mistakes","Ekle":"add",
 "Listem":"my list","Düzenle":"edit","Soru kelimeleri":"question words","Şekiller":"shapes","Durumlar":"situations",
 "Tamir çantası":"repair kit","Anlamadıysan":"if you did not catch it","Ne konuşuldu":"what was said",
 "Nasıl işaretlenir":"how it is marked","Cümleler":"sentences","Kalıplar":"set phrases",
 /* prompts and states */
 "Seç":"choose","Boşluğu doldur":"fill the gap","Cümleyi kur":"build the sentence","Duy":"listen",
 "Evet / hayır":"yes / no","Seviye sınavı":"placement test","Geçtiniz":"you passed",
 "Biraz daha çalışmak gerek":"a little more work needed","Önerilen başlangıç seviyesi":"suggested starting level",
 "Tamamlandı":"completed","Yarıda kaldı":"left unfinished","Bugünlük bitti":"done for today","Bugünlük bu kadar":"that is all for today",
 "Defter boş":"the book is empty","Henüz dilbilgisi yok":"no grammar yet","Ses yok":"no sound",
 "Üç kez anlatıldı ✓":"told three times","Bu aramaya uygun kelime yok.":"no word matches this search",
 "Henüz kendi kelimen yok.":"you have not added a word yet","5 dakika":"5 minutes","10 dakika":"10 minutes",
 "Sor · soru sözcükleri":"ask · question words","Sor · evet/hayır":"ask · yes or no",
 "kelime gözden geçirildi":"words gone over","Kalıp · günlük konuşma":"set phrase · everyday speech",
 "senin cevabın":"your answer","Ses önce":"audio first","Söz":"sayings","Sayılar":"numbers","hazır":"ready"
};
/* Labels with a number or a name in them. */
const EN_RULES=[
 [/^(.+) ile başla$/,m=>"start with "+m[1]],
 [/^(\d+) kelime ve cümle$/,()=>"words and sentences"],
 [/^(\d+) soru$/,m=>m[1]==="1"?"1 question":m[1]+" questions"],
 [/^(\d+) basamak$/,m=>m[1]+" digits"],
 [/^(\d+) kelime$/,()=>"words"],
 [/^(\d+) kelime · bu oturum$/,()=>"words this sitting"],
 [/^(\d+) konu · bu oturum$/,()=>"grammar points this sitting"],
 [/^(\d+) kelime gözden geçirildi$/,()=>"words gone over"],
 [/^(\d+) kelime bugün hâlâ bekliyor\.$/,()=>"still waiting today"],
 [/^Ders (\d) bitti$/,m=>"lesson "+m[1]+" done"],
 [/^(A1|A2|B1|B2|C1|C2) seviye sınavı$/,m=>m[1]+" level test"],
 [/^Atasözleri · (\d+) hazır$/,m=>"proverbs · "+m[1]+" ready"],
 [/^Deyimler · (\d+) hazır$/,m=>"idioms · "+m[1]+" ready"],
 [/^Kaydet · (\d+) kaçtı$/,m=>"save · "+m[1]+" got away"],
 [/^(\d+) kelime · (\d+) bugün$/,()=>"words · today"],
 [/^Zor: bugün tekrar · İyi: (\d+) gün sonra$/,m=>"hard: again today · good: in "+m[1]+(m[1]==="1"?" day":" days")],
 [/^(Tümü|İsim|Fiil|Sıfat|Zarf|Edat|İfade) (\d+)$/,m=>EN_UI[m[1]]]
];
/* English halves already written inline after a ·, moved underneath. */
const EN_INLINE=[
 "say it three times","the rest","hide this","show the pattern","read the point again","mine was right too",
 "stop and mark","drill these","review them","walk away","place me","hide on the home screen","mine is said too",
 "how to add one","ten more","where to","caught you twice or more","speaking","listening","bringing it back","words",
 "how it is said","listening and shadowing","the review queue","what the course teaches once","produce the pattern",
 "listening without the text","saying it first","asking","taking a word apart","your own islands","keeping it alive","write","get them checked","copy","correct it","it was right","say your islands","read for fun","open the unit","once more","the hours outside","log a sitting","caught a word?","said whole","numbers at speed",
 "your own words","the mistake book","hands-free","how many words","the texts","back up",
 "build it","change it","the gap","where sentences come from","write what you hear","audio first","listening speed",
 "replays allowed","the model’s speed","ask the question","write the digits","read it out","how high","the bar",
 "no Turkish voice","no speech","out loud now","say it out loud now","the speaking task","your own marking",
 "marked by the app","recalled","covered","words reviewed","produced","produced exactly","listen","spoken form",
 "other ways to say it","why",
 "make it negative","change it to “he”","turn it into a question","change it to “we”","put it in the future",
 "put it in the past","ask the question this answers","make it a yes-no question",
 "say it","backward buildup","then say whether it landed","recall it","type what you hear","read it out loud",
 "say it, then tap it","type what they said","what do you say?","which idiom?","show the answer",
 "between friends","with anyone","told","make it positive","proverb","idiom"
];
const EN_EL=/^(button|h2|p|div|span)$/, EN_CLS=/\b(btn|sec|lead|qn|sub|pill|big|empty|tiny|sbtn|tab)\b/,
      EN_SKIP=/\b(opt|tile|icon-btn|spd|vtr|ven|gw|dw|mark|tr|nav-t|lvl-badge|bar-title|block-t|block-e|unit-s|unit-t|gl)\b/;
function enOf(t){
  if(EN_UI[t])return {tr:t,en:EN_UI[t]};
  for(const r of EN_RULES){const m=r[0].exec(t); if(m){const e=r[1](m); if(e)return {tr:t,en:e};}}
  const i=t.lastIndexOf(" · ");
  if(i>0){const en=t.slice(i+3);
    if(EN_INLINE.indexOf(en)>=0||/^add (it|these \d+) to my reviews$/.test(en))return {tr:t.slice(0,i),en:en};}
  return null;
}
/* Entities are decoded for the lookup and the text written back escaped,
   so a key never has to be spelt in HTML. */
function enUnder(h){
  return h.replace(/<(button|h2|p|div|span)\b([^>]*)>([^<]+)(?=<)/g,function(all,tag,attr,text,at){
    /* Already carries its English — a tab's <i>, a title's <small>. */
    const next=h.substr(at+all.length,7);
    if(next.indexOf("<i>")===0||next.indexOf("<small>")===0)return all;
    const c=/class="([^"]*)"/.exec(attr); const cls=c?c[1]:"";
    if(tag!=="button"&&!EN_CLS.test(cls))return all;
    if(EN_SKIP.test(cls))return all;
    const t=text.trim(); if(!t)return all;
    const raw=t.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
    const g=enOf(raw); if(!g)return all;
    const lead=text.slice(0,text.indexOf(t[0]));
    return '<'+tag+attr+'>'+lead+esc(g.tr)+'<span class="gl">'+esc(g.en)+'</span>';
  });
}
/* Instruction prose in both languages; which shows is the stage's call. */
function tx(en,tr){return '<span class="t-tr">'+tr+'</span><span class="t-en">'+en+'</span>';}
/* The same for plain text — a confirm() or a message poked in with
   textContent — which cannot hold two spans. */
function txt(en,tr){const m=enMode();return m==="en"?en:m==="tr"?tr:tr+" ("+en+")";}
/* Less English the further the learner gets, the way a school moves its
   classroom language over: labels first, then instructions, and (later)
   the explanations. The stage is the level being worked in — the level of
   the unit after the furthest one passed — so passing the A2 test puts a
   learner in B1 at once, and dipping back into an old unit changes
   nothing.

     stage 0  A1–A2  labels Turkish with English under · instructions English
     stage 1  B1     labels Turkish · instructions Turkish, English under
     stage 2  B2+    labels Turkish · instructions Turkish

   The EN button is "show me the English now". A choice is stored with the
   stage it was made in and lapses when the stage changes, so turning the
   English on at A2 does not hold it on through C2. A choice saved before
   the stages existed was a plain true/false and counts as a stage-0 one.
   Off is Turkish only everywhere, stage 0 included: a beginner who wants
   the instructions in Turkish can have them. */
function curLv(){
  let k=-1;
  for(let i=0;i<UNITS.length;i++)if(isDone(UNITS[i].id))k=i;
  return UNITS[Math.min(k+1,UNITS.length-1)].lv;
}
function enStage(){const lv=curLv();return lv==="A1"||lv==="A2"?0:lv==="B1"?1:2;}
function enChoice(st){
  const e=S.en;
  if(e===undefined||e===null)return undefined;
  if(typeof e==="boolean")return st===0?e:undefined;
  return e.st===st?!!e.on:undefined;
}
function enOn(){const st=enStage(), c=enChoice(st);return c!==undefined?c:st<=1;}
function enLabels(){const st=enStage(), c=enChoice(st);return c!==undefined?c:st===0;}
function enMode(){return !enOn()?"tr":enStage()===0?"en":"both";}
function enApply(){try{
  const c=document.documentElement.classList, m=enMode();
  c.toggle("noen",!enLabels());
  ["en","both","tr"].forEach(function(x){c.toggle("ins-"+x,x===m);});
}catch(e){}}
function toggleEN(){S.en={st:enStage(),on:!enOn()}; save(); enApply();
  document.querySelectorAll(".en-btn").forEach(function(b){b.setAttribute("aria-pressed",String(enOn()));});}
function enBtn(){return '<button class="icon-btn en-btn" onclick="toggleEN()" aria-pressed="'+enOn()+'" aria-label="English under the Turkish">EN</button>';}
function paint(h){enApply(); app().innerHTML=enUnder(h);}

function bar(title,sub,showHome,subTr){
  return '<div class="bar"><div class="bar-in">'+
   '<button class="icon-btn" onclick="back()" aria-label="Back">'+IC.back+'</button>'+
   (showHome?'<button class="icon-btn" onclick="home()" aria-label="Home">'+IC.home+'</button>':'')+
   '<div class="bar-title">'+esc(title)+(sub?'<small>'+(subTr?tx(esc(sub),esc(subTr)):esc(sub))+'</small>':'')+'</div>'+
   enBtn()+
   '<button class="icon-btn" onclick="toggleTheme()" aria-label="Theme">'+themeIcon()+'</button>'+
   '</div>'+saveWarn()+'</div>';
}

