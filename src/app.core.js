/* Core: saved state, the small helpers every screen uses, the voice
   player, the spaced-repetition ladder, and routing. Nothing here
   draws a screen. */

/* ===================== app ===================== */
const APP_VERSION="v3.56";

/* ===================== storage ===================== */
const KEY="turkce-course-v1";
let S={done:{},seen:{},place:null,star:[],tested:{},days:[],theme:null,srs:{},rate:0.85,
       prod:{},retell:{},gap:4,prompten:false,pscope:"done",
       dinle:{},drate:1,dreplay:2,rep:{},gram:{},ygap:5,yrate:1,err:{},mine:[],
       num:{},nmax:999,ncap:5,dia:{},ata:{},tips:true};
function load(){
  try{const r=localStorage.getItem(KEY); if(r){const o=JSON.parse(r); if(o&&typeof o==="object") S=Object.assign(S,o);}}catch(e){}
  if(!S.done)S.done={}; if(!S.seen)S.seen={}; if(!S.star)S.star=[]; if(!S.tested)S.tested={}; if(!S.days)S.days=[]; if(!S.srs)S.srs={};
  if(!S.prod)S.prod={}; if(!S.retell)S.retell={}; if(!S.dinle)S.dinle={}; if(!S.rep)S.rep={};
  /* S.gram is the grammar schedule, keyed by unit id — not a unit's own
     gram: block. S.num is keyed by the shape of a number, not a number. */
  if(!S.gram)S.gram={}; if(!S.err)S.err={}; if(!S.mine)S.mine=[]; if(!S.num)S.num={}; if(!S.dia)S.dia={};
  /* S.ata is keyed by a saying's slug — "a:<id>"/"d:<id>" — not by a position. */
  if(!S.ata)S.ata={};
}
function save(){ try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){} }
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
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fold(s){
  return String(s).replace(/İ/g,"i").replace(/I/g,"i").replace(/ı/g,"i").replace(/Ş/g,"s").replace(/ş/g,"s")
   .replace(/Ğ/g,"g").replace(/ğ/g,"g").replace(/Ü/g,"u").replace(/ü/g,"u").replace(/Ö/g,"o").replace(/ö/g,"o")
   .replace(/Ç/g,"c").replace(/ç/g,"c").replace(/[âÂ]/g,"a").replace(/[îÎ]/g,"i").replace(/[ûÛ]/g,"u")
   .toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
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

/* Inline onclick handlers carry word text, so it has to survive being
   pasted into a JS string literal inside an HTML attribute. */
function jsq(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");}

const IC={
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
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
const VOICE={rate:0.85,mode:null,idx:0,tid:null,ready:false};
function ttsOK(){return typeof window!=="undefined"&&"speechSynthesis"in window;}
function trVoice(){
  if(!ttsOK())return null;
  let vs=[];try{vs=speechSynthesis.getVoices()||[];}catch(e){}
  return vs.find(v=>/^tr/i.test(v.lang))||null;
}
if(ttsOK()){try{speechSynthesis.onvoiceschanged=function(){VOICE.ready=true;};}catch(e){}}
function say(text,rate,onend,lang){
  if(!ttsOK())return false;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const v=lang?null:trVoice(); if(v)u.voice=v;
    u.lang=lang||"tr-TR"; u.rate=rate||VOICE.rate;
    if(onend)u.onend=onend;
    speechSynthesis.speak(u); return true;
  }catch(e){return false;}
}
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
const STEPS=[0,1,2,4,8,16,32,64,120];
function dayNum(){return Math.floor(Date.now()/86400000);}
function srsAdd(k){if(!S.srs)S.srs={};if(!S.srs[k])S.srs[k]={b:0,d:dayNum()};}
function srsDrop(k){if(S.srs)delete S.srs[k];}
/* Words and produced sentences climb the same ladder in different
   stores, so the box arithmetic lives here once. next() is given the
   current box and returns the new one. */
function isDue(map,k){const r=map&&map[k];return !r||r.d<=dayNum();}
function bump(map,k,next){
  const r=map[k]||{b:0,d:dayNum()};
  r.b=Math.max(0,Math.min(next(r.b),STEPS.length-1));
  r.d=dayNum()+STEPS[r.b];
  map[k]=r; return r;
}
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
function dueQueue(map,bank,limit){
  const n=dayNum(), old=[], fresh=[];
  bank.forEach(function(it){
    const r=map&&map[it.k];
    if(r){if(r.d<=n)old.push(it);}else fresh.push(it);
  });
  old.sort(function(x,y){return map[x.k].d-map[y.k].d;});
  return old.concat(fresh).slice(0,limit);
}

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
            "sayilar","diyalog","ata","words","dict","about","nasil"];
function back(){
  if(V.view==="unit"){go("level",unit(V.u).lv);}
  else if(V.view==="quiz"&&Q&&Q.mode==="unit"){go("unit",Q.u,"d");}
  else if(V.view==="quiz"&&Q&&Q.mode==="level"){go("level",Q.lv);}
  else if(V.view==="prodrun"){go("prod");}
  else if(V.view==="dinlerun"){go("dinle");}
  else if(V.view==="tekrarrun"){go("tekrar");}
  else if(V.view==="gramrun"){go("gram");}
  /* Leaving a sitting mid-drive should not throw away what was covered:
     the back arrow and the Bitir button do the same thing, which is what
     a learner expects of a mode whose whole point is not touching it. */
  else if(V.view==="yoldarun"){if(YL&&YL.phase!=="end")yolFinish();else{YL=null;go("yolda");}}
  else if(V.view==="retell"){go("unit",V.u,"r");}
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
function bar(title,sub,showHome){
  return '<div class="bar"><div class="bar-in">'+
   '<button class="icon-btn" onclick="back()" aria-label="Back">'+IC.back+'</button>'+
   (showHome?'<button class="icon-btn" onclick="home()" aria-label="Home">'+IC.home+'</button>':'')+
   '<div class="bar-title">'+esc(title)+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>'+
   '<button class="icon-btn" onclick="toggleTheme()" aria-label="Theme">'+themeIcon()+'</button>'+
   '</div></div>';
}

