/* ===================== app ===================== */
const APP_VERSION="v2.10";

/* ===================== storage ===================== */
const KEY="turkce-course-v1";
let S={done:{},seen:{},place:null,star:[],tested:{},days:[],theme:null,srs:{},rate:0.85,
       prod:{},retell:{},gap:4,prompten:false,pscope:"done"};
function load(){
  try{const r=localStorage.getItem(KEY); if(r){const o=JSON.parse(r); if(o&&typeof o==="object") S=Object.assign(S,o);}}catch(e){}
  if(!S.done)S.done={}; if(!S.seen)S.seen={}; if(!S.star)S.star=[]; if(!S.tested)S.tested={}; if(!S.days)S.days=[]; if(!S.srs)S.srs={};
  if(!S.prod)S.prod={}; if(!S.retell)S.retell={};
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
const $=s=>document.querySelector(s);
const app=()=>document.getElementById("app");
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fold(s){
  return String(s).replace(/İ/g,"i").replace(/I/g,"i").replace(/ı/g,"i").replace(/Ş/g,"s").replace(/ş/g,"s")
   .replace(/Ğ/g,"g").replace(/ğ/g,"g").replace(/Ü/g,"u").replace(/ü/g,"u").replace(/Ö/g,"o").replace(/ö/g,"o")
   .replace(/Ç/g,"c").replace(/ç/g,"c").replace(/[âÂ]/g,"a").replace(/[îÎ]/g,"i").replace(/[ûÛ]/g,"u")
   .toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
function unitsOf(lv){return UNITS.filter(u=>u.lv===lv);}
function unit(id){return UNITS.find(u=>u.id===id);}
function isDone(id){return !!S.done[id];}
function lvDone(lv){return unitsOf(lv).filter(u=>isDone(u.id)).length;}
function lvPct(lv){const a=unitsOf(lv);return a.length?Math.round(100*lvDone(lv)/a.length):0;}
function allPct(){return Math.round(100*UNITS.filter(u=>isDone(u.id)).length/UNITS.length);}
function currentLevel(){for(const l of LEVELS){if(lvPct(l.id)<100)return l.id;}return "C2";}
function nextUnit(){for(const u of UNITS){if(!isDone(u.id))return u;}return null;}

const IC={
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
 chev:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
 spk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
 play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l12 8-12 8z"/></svg>',
 stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"/></svg>'
};


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
function setRate(r){VOICE.rate=r;S.rate=r;save();const m=VOICE.mode,i=VOICE.idx;stopPlay();
  document.querySelectorAll(".spd").forEach(function(b){b.classList.toggle("on",Math.abs(parseFloat(b.dataset.r)-r)<0.01);});
  if(m)playFrom(i,m);}

/* ===================== review queue (SRS) ===================== */
const STEPS=[0,1,2,4,8,16,32,64,120];
function dayNum(){return Math.floor(Date.now()/86400000);}
function srsAdd(k){if(!S.srs)S.srs={};if(!S.srs[k])S.srs[k]={b:0,d:dayNum()};}
function srsDrop(k){if(S.srs)delete S.srs[k];}
function dueList(){
  if(!S.srs)S.srs={};
  const n=dayNum();
  return S.star.filter(function(k){const r=S.srs[k];return !r||r.d<=n;});
}
function grade(k,g){
  if(!S.srs)S.srs={};
  const r=S.srs[k]||{b:0,d:dayNum()};
  if(g===0)r.b=0; else if(g===1)r.b=Math.min(r.b+1,STEPS.length-1); else r.b=Math.min(r.b+2,STEPS.length-1);
  r.d=dayNum()+STEPS[r.b]; S.srs[k]=r; save();
}
let RV=null;
function startReview(){
  const q=shuffle(dueList());
  if(!q.length){V={view:"words"};render();return;}
  RV={q:q,i:0,show:false,done:0}; V={view:"review"}; window.scrollTo(0,0); render();
}
function rvFlip(){RV.show=true;render();}
function rvGrade(g){grade(RV.q[RV.i],g);RV.done++;RV.i++;RV.show=false;window.scrollTo(0,0);render();}
function renderReview(){
  if(RV.i>=RV.q.length){
    app().innerHTML=bar("Tekrar","Bitti",true)+'<div class="wrap"><div class="score"><div class="big pass">'+RV.done+'</div>'+
      '<p class="sub">kelime tekrar edildi · words reviewed</p></div>'+
      '<p class="sub" style="text-align:center">'+dueList().length+' kelime bugün hâlâ bekliyor.</p>'+
      '<button class="btn" onclick="startReview()">Devam</button><button class="btn ghost" onclick="home()">Ana sayfa</button></div>';
    return;
  }
  const k=RV.q[RV.i], p=k.split("|"), r=(S.srs&&S.srs[k])||{b:0};
  let h=bar("Tekrar",(RV.i+1)+" / "+RV.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+RV.q.map(function(_,i){return '<i class="'+(i<RV.i?"ok":"")+'"></i>';}).join('')+'</div>';
  h+='<div class="card" style="text-align:center;padding:2.4rem 1rem">'+
    '<p class="mark" style="font-size:2rem;margin:0">'+esc(p[0])+'</p>'+
    '<button class="sbtn" style="margin-top:.7rem" onclick="sayWord(\''+p[0].replace(/'/g,"\\'")+'\')">'+IC.spk+' dinle</button>'+
    (RV.show?'<p class="sub" style="margin-top:1rem;font-size:1.05rem">'+esc(p[1])+'</p>':'')+
    '<p class="tiny" style="margin-top:.8rem">kutu '+(r.b+1)+' / '+STEPS.length+'</p></div>';
  if(!RV.show)h+='<button class="btn" onclick="rvFlip()">Göster</button>';
  else h+='<div class="btn-row"><button class="btn ghost" onclick="rvGrade(0)">Zor</button>'+
    '<button class="btn" onclick="rvGrade(1)">İyi</button>'+
    '<button class="btn gold" onclick="rvGrade(2)">Kolay</button></div>'+
    '<p class="tiny" style="text-align:center;margin-top:.6rem">Zor: bugün tekrar · İyi: '+STEPS[Math.min(((S.srs&&S.srs[k]||{b:0}).b)+1,STEPS.length-1)]+' gün sonra</p>';
  h+='</div>';
  app().innerHTML=h;
}

/* ===================== routing ===================== */
let V={view:"home"};
let Q=null;
function go(view,a,b){stopPlay();V={view:view,lv:a,u:a,sec:b}; if(view==="unit")V={view:"unit",u:a,sec:b||"v"}; window.scrollTo(0,0); render();}
function home(){stopPlay();V={view:"home"};window.scrollTo(0,0);render();}
function back(){
  if(V.view==="unit"){go("level",unit(V.u).lv);}
  else if(V.view==="quiz"&&Q&&Q.mode==="unit"){go("unit",Q.u,"d");}
  else if(V.view==="quiz"&&Q&&Q.mode==="level"){go("level",Q.lv);}
  else if(V.view==="prodrun"){go("prod");}
  else if(V.view==="retell"){go("unit",V.u,"r");}
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

/* ===================== home ===================== */
function ring(pct){
  const r=34,c=2*Math.PI*r,off=c*(1-pct/100);
  return '<svg class="ring" width="88" height="88" viewBox="0 0 88 88">'+
   '<circle cx="44" cy="44" r="'+r+'" fill="none" stroke="var(--sunk)" stroke-width="7"/>'+
   '<circle cx="44" cy="44" r="'+r+'" fill="none" stroke="var(--turk)" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 44 44)"/>'+
   '<text x="44" y="50" text-anchor="middle" font-family="Crimson Pro,serif" font-size="22" font-weight="600" fill="var(--ink)">'+pct+'%</text></svg>';
}
function renderHome(){
  const here=currentLevel(), nx=nextUnit();
  let road='<div class="road"><div class="road-line"></div><div class="road-fill" style="width:'+(88*allPct()/100).toFixed(1)+'%"></div><div class="road-stops">';
  LEVELS.forEach(l=>{
    const cls=lvPct(l.id)===100?"done":(l.id===here?"here":"");
    road+='<button class="stop '+cls+'" onclick="go(\'level\',\''+l.id+'\')"><i></i><b>'+l.id+'</b></button>';
  });
  road+='</div></div>';

  let h='<div class="bar"><div class="bar-in"><div style="width:34px"></div><div class="bar-title">Türkçe<small>A1 → C2</small></div>'+
   '<button class="icon-btn" onclick="toggleTheme()" aria-label="Theme">'+themeIcon()+'</button></div></div>';
  h+='<div class="wrap"><div class="hero"><h1 class="mark">türkçe<span class="dot">.</span></h1>'+
   '<p class="tag">A reading course from first words to literature</p></div>'+road;

  h+='<div class="stat"><div><b>'+UNITS.filter(u=>isDone(u.id)).length+'</b><span>units done</span></div>'+
     '<div><b>'+streak()+'</b><span>day streak</span></div>'+
     '<div><b>'+S.star.length+'</b><span>saved words</span></div></div>';

  if(S.place&&unit(S.place.u)){
    const u=unit(S.place.u);
    h+='<button class="card resume row" onclick="go(\'unit\',\''+u.id+'\',\''+S.place.s+'\')">'+
      '<div class="grow"><p class="tiny">Devam et · pick up where you left off</p>'+
      '<p class="lead">'+esc(u.lv+" · "+u.tr)+'</p><p class="sub">'+esc(secName(S.place.s))+'</p></div><span class="chev">'+IC.chev+'</span></button>';
  }else if(nx){
    h+='<button class="card resume row" onclick="go(\'unit\',\''+nx.id+'\',\'v\')"><div class="grow">'+
      '<p class="tiny">Başla · start here</p><p class="lead">'+esc(nx.lv+" · "+nx.tr)+'</p>'+
      '<p class="sub">'+esc(nx.en)+'</p></div><span class="chev">'+IC.chev+'</span></button>';
  }

  h+='<h2 class="sec">Seviyeler</h2>';
  LEVELS.forEach(l=>{
    const p=lvPct(l.id), t=S.tested[l.id];
    h+='<button class="card" onclick="go(\'level\',\''+l.id+'\')"><div class="row">'+
      '<span class="lvl-badge '+(p===100?"on":(t?"tested":""))+'">'+l.id+'</span>'+
      '<div class="grow"><p class="lead">'+esc(l.tr)+'</p><p class="sub">'+esc(l.en)+' · '+lvDone(l.id)+'/'+unitsOf(l.id).length+' ünite</p></div>'+
      '<span class="chev">'+IC.chev+'</span></div><div class="meter"><i style="width:'+p+'%"></i></div></button>';
  });

  const due=dueList().length;
  if(due)h+='<button class="card row" style="border-left:3px solid var(--turk)" onclick="startReview()"><div class="grow">'+
    '<p class="tiny">Günün tekrarı · spaced review</p><p class="lead">'+due+' kelime bekliyor</p>'+
    '<p class="sub">Words come back on a widening schedule until they stick.</p></div><span class="chev">'+IC.chev+'</span></button>';
  const pd=prodDue(sentenceBank()).length+prodDue(chunkBank()).length, rt=retellDue().length;
  if(pd||rt)h+='<button class="card row" style="border-left:3px solid var(--cobalt)" onclick="go(\'prod\')"><div class="grow">'+
    '<p class="tiny">Üretim · say it before you hear it</p>'+
    '<p class="lead">'+pd+' cümle'+(rt?' · '+rt+' anlatım':'')+' bekliyor</p>'+
    '<p class="sub">English prompt, a silent gap, then the model. The sentence has to come out of your mouth first.</p>'+
    '</div><span class="chev">'+IC.chev+'</span></button>';
  h+='<h2 class="sec">Araçlar</h2>'+
   navRow("Üretim","Speak the sentence before the model plays — "+(UNITS.reduce(function(n,u){return n+u.read.lines.length;},0)+CHUNKS.length)+" prompts","go('prod')")+
   navRow("Seviye sınavı","Placement test — find your level in 12 questions","startPlacement()")+
   navRow("Sözlüğüm","Saved words ("+S.star.length+") · review queue and flashcards","go('words')")+
   navRow("Bu kurs hakkında","How the course works, and where the texts come from","go('about')");

  h+='<p class="foot">Progress is stored on this device only.<br>Texts are original, adapted or public domain — see About.</p></div>';
  app().innerHTML=h;
}
function navRow(t,s,fn){
  return '<button class="card row" onclick="'+fn+'"><div class="grow"><p class="lead">'+esc(t)+'</p><p class="sub">'+esc(s)+'</p></div><span class="chev">'+IC.chev+'</span></button>';
}

/* ===================== level ===================== */
function renderLevel(){
  const l=LEVELS.find(x=>x.id===V.lv), us=unitsOf(l.id), p=lvPct(l.id);
  let h=bar(l.tr,l.id+" · "+l.en,true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+esc(l.blurb)+'</p>';
  h+='<div class="meter" style="margin-bottom:1.2rem"><i style="width:'+p+'%"></i></div>';
  h+='<div class="card" style="padding:.2rem 1rem">';
  us.forEach(u=>{
    const d=isDone(u.id), t=S.done[u.id]&&S.done[u.id].byTest;
    h+='<button class="unit" onclick="go(\'unit\',\''+u.id+'\',\'v\')">'+
      '<span class="tick '+(d?"done":"")+'">'+(d?IC.check:u.n)+'</span>'+
      '<span class="grow"><span class="unit-t">'+esc(u.tr)+'</span>'+
      '<span class="unit-s">'+esc(u.en)+' · '+esc(u.focus)+(t?' · tested out':'')+'</span></span>'+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  h+='</div>';
  h+='<h2 class="sec">İleri test</h2>'+
   '<div class="card"><p class="lead">'+esc(l.id)+' seviye sınavı</p>'+
   '<p class="sub">Ten questions drawn from the whole level. Score 8 or more and the level is marked complete — use this to skip material you already know.</p>'+
   '<button class="btn gold" onclick="startLevelExam(\''+l.id+'\')">Test ahead</button></div>';
  h+='</div>';
  app().innerHTML=h;
}

/* ===================== unit ===================== */
const SECS=[["v","Kelimeler","words"],["g","Dilbilgisi","grammar"],["r","Okuma","reading"],["d","Alıştırma","practice"]];
function secName(k){const s=SECS.find(x=>x[0]===k);return s?s[1]+" · "+s[2]:"";}
function markSeen(uid,sec){ if(!S.seen[uid])S.seen[uid]={}; S.seen[uid][sec]=1; S.place={u:uid,s:sec}; touchDay(); save(); }
function renderUnit(){
  const u=unit(V.u), sec=V.sec||"v";
  markSeen(u.id,sec);
  let h=bar(u.tr,u.lv+" · Ünite "+u.n,true)+'<div class="wrap">';
  h+='<div class="segs">';
  SECS.forEach(s=>{
    const on=s[0]===sec, seen=S.seen[u.id]&&S.seen[u.id][s[0]];
    h+='<button class="'+(on?"on":"")+'" onclick="go(\'unit\',\''+u.id+'\',\''+s[0]+'\')">'+s[1]+'<i>'+(seen?"✓ ":"")+s[2]+'</i></button>';
  });
  h+='</div>';
  if(sec==="v")h+=secVocab(u);
  if(sec==="g")h+=secGram(u);
  if(sec==="r")h+=secRead(u);
  if(sec==="d")h+=secDrill(u);
  h+='</div>';
  app().innerHTML=h;
}
function starKey(tr,en){return tr+"|"+en;}
function toggleStar(i){
  const u=unit(V.u), k=starKey(u.vocab[i][0],u.vocab[i][1]);
  const at=S.star.indexOf(k);
  if(at<0){S.star.push(k);srsAdd(k);} else {S.star.splice(at,1);srsDrop(k);}
  save(); render();
}
function secVocab(u){
  const allIn=u.vocab.every(w=>S.star.indexOf(starKey(w[0],w[1]))>-1);
  let h='<p class="src">Tap a word to hear it. Tap the star to send it to your review queue.</p><div class="card" style="padding:.3rem 1rem">';
  u.vocab.forEach((w,i)=>{
    const on=S.star.indexOf(starKey(w[0],w[1]))>-1;
    h+='<div class="vrow"><button class="sbtn" onclick="sayWord(\''+w[0].replace(/'/g,"\\'")+'\')" aria-label="Listen">'+IC.spk+'</button>'+
      '<div class="grow"><div class="vtr">'+esc(w[0])+'</div><div class="ven">'+esc(w[1])+'</div></div>'+
      '<button class="star '+(on?"on":"")+'" onclick="toggleStar('+i+')" aria-label="Save word">'+IC.star+'</button></div>';
  });
  h+='</div><button class="btn ghost" onclick="starAll(\''+u.id+'\')">'+(allIn?"Tümü listede ✓":"Tüm kelimeleri tekrara ekle")+'</button>'+
   '<button class="btn" onclick="go(\'unit\',\''+u.id+'\',\'g\')">Dilbilgisine geç →</button>';
  return h;
}
function starAll(uid){
  const u=unit(uid);
  u.vocab.forEach(w=>{const k=starKey(w[0],w[1]); if(S.star.indexOf(k)<0){S.star.push(k);srsAdd(k);}});
  save(); render();
}
function secGram(u){
  const g=u.gram;
  let h='<div class="card gram"><p class="lead">'+esc(g.t)+'</p><p class="tiny" style="margin:.1rem 0 .6rem">'+esc(g.en)+'</p>';
  g.body.forEach(p=>{h+='<p>'+p+'</p>';});
  if(g.tbl){h+='<table class="table">';g.tbl.forEach(r=>{h+='<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>';});h+='</table>';}
  h+='<div class="egs">';
  g.eg.forEach(e=>{h+='<div class="eg"><b>'+esc(e[0])+'</b><span>'+esc(e[1])+'</span></div>';});
  h+='</div></div><button class="btn" onclick="go(\'unit\',\''+u.id+'\',\'r\')">Okumaya geç →</button>';
  return h;
}
function glossify(txt,gl){
  if(!gl)return esc(txt);
  const keys=Object.keys(gl).sort((a,b)=>b.length-a.length);
  let s2=txt, marks=[];
  keys.forEach(k=>{
    const i=s2.indexOf(k);
    if(i>-1){ marks.push([k,gl[k]]); s2=s2.slice(0,i)+"\u0001"+(marks.length-1)+"\u0002"+s2.slice(i+k.length); }
  });
  return esc(s2).replace(/\u0001(\d+)\u0002/g,function(m,n){
    const p=marks[+n];
    return '<span class="gw" data-g="'+esc(p[1])+'" data-w="'+esc(p[0])+'">'+esc(p[0])+'</span>';
  });
}

function secRead(u){
  const r=u.read;
  let h='<p class="lead" style="font-family:\'Crimson Pro\',serif;font-size:1.4rem">'+esc(r.t)+'</p>'+
   '<p class="src"><b>'+esc(r.kind)+'</b><br>'+esc(r.src)+'</p>';
  if(r.note)h+='<div class="card" style="background:var(--sunk);border-style:dashed"><p class="sub" style="margin:0">'+esc(r.note)+'</p></div>';
  h+=voiceBar();
  h+='<p class="tiny" style="margin:.9rem .2rem .5rem">Tap a line for the English, or the speaker to hear it. Dotted words carry a gloss.</p><div class="passage" id="passage">';
  r.lines.forEach((ln,i)=>{
    h+='<p class="ln" id="ln'+i+'" onclick="lineTap(event,'+i+')">'+
      '<button class="sbtn ln-spk" onclick="event.stopPropagation();sayLine('+i+')" aria-label="Listen">'+IC.spk+'</button>'+
      glossify(ln[0],r.gloss)+'<em style="display:none">'+esc(ln[1])+'</em></p>';
  });
  h+='</div>';
  if(r.gloss){
    h+='<h2 class="sec">Sözlük</h2><div class="card" style="padding:.3rem 1rem">';
    Object.keys(r.gloss).forEach(k=>{h+='<div class="vrow"><div class="grow"><div class="vtr" style="font-size:.97rem">'+esc(k)+'</div><div class="ven">'+esc(r.gloss[k])+'</div></div></div>';});
    h+='</div>';
  }
  h+='<h2 class="sec">Konuşma</h2><div class="speak"><p class="lead">'+esc(u.speak)+'</p>'+
   '<button class="btn ghost" style="margin-top:.75rem" onclick="startRetell(\''+u.id+'\')">Üç kez anlat · say it three times</button></div>';
  h+='<button class="btn" onclick="go(\'unit\',\''+u.id+'\',\'d\')">Alıştırmalara geç →</button>';
  return h;
}
function voiceBar(){
  const r=S.rate||VOICE.rate;
  let h='<div class="vbar"><div class="vrow2">'+
   '<button class="vb" id="btn-listen" onclick="playFrom(0,\'listen\')">'+IC.play+' Dinle</button>'+
   '<button class="vb" id="btn-shadow" onclick="playFrom(0,\'shadow\')">'+IC.spk+' Gölge</button>'+
   '<button class="vb" onclick="stopPlay()">'+IC.stop+' Dur</button></div>'+
   '<div class="vrow2 spds">';
  [0.6,0.75,0.85,1].forEach(function(x){
    h+='<button class="spd '+(Math.abs(x-r)<0.01?"on":"")+'" data-r="'+x+'" onclick="setRate('+x+')">'+x+'×</button>';
  });
  h+='</div><p class="tiny" id="vstat" style="margin:.45rem 0 0;min-height:1.1em"></p>'+
   '<p class="tiny" style="margin:.3rem 0 0">Gölge: each line plays, then waits the same length for you to repeat it aloud.</p></div>';
  return h;
}
function lineTap(ev,i){
  const t=ev.target;
  if(t&&t.closest&&t.closest(".sbtn"))return;
  if(t&&t.classList&&t.classList.contains("gw")){ev.stopPropagation();showBubble(ev,t);return;}
  hideBubble();
  const p=document.getElementById("ln"+i); if(!p)return;
  const em=p.querySelector("em"); const open=em.style.display!=="none";
  em.style.display=open?"none":"block"; p.classList.toggle("open",!open);
}
let bub=null;
function hideBubble(){if(bub){bub.remove();bub=null;}}
function showBubble(ev,el){
  hideBubble();
  bub=document.createElement("div"); bub.className="bubble";
  bub.innerHTML='<b>'+el.getAttribute("data-w")+'</b> — '+el.getAttribute("data-g");
  document.body.appendChild(bub);
  const r=el.getBoundingClientRect(), bw=bub.offsetWidth, bh=bub.offsetHeight;
  let x=r.left+r.width/2-bw/2; x=Math.max(8,Math.min(x,window.innerWidth-bw-8));
  let y=r.top-bh-8; if(y<8)y=r.bottom+8;
  bub.style.left=x+"px"; bub.style.top=y+"px";
}
document.addEventListener("click",e=>{if(bub&&!e.target.classList.contains("gw"))hideBubble();},true);
window.addEventListener("scroll",hideBubble,{passive:true});

function secDrill(u){
  const d=S.done[u.id];
  let h='';
  if(d)h+='<div class="card" style="border-color:var(--turk)"><p class="lead">Tamamlandı ✓</p><p class="sub">Best score '+d.score+'/'+(d.of||u.drill.length)+(d.byTest?" · passed by level test":"")+'. Run it again any time.</p></div>';
  h+='<div class="card"><p class="lead">'+u.drill.length+' soru</p><p class="sub">Multiple choice, gap-fill and sentence building. Answer '+Math.ceil(u.drill.length*0.8)+' or more correctly to complete the unit.</p>'+
   '<button class="btn" onclick="startUnitQuiz(\''+u.id+'\')">Başla</button></div>';
  return h;
}

/* ===================== quiz engine ===================== */
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function startUnitQuiz(uid){
  const u=unit(uid);
  Q={mode:"unit",u:uid,lv:u.lv,items:u.drill.slice(),i:0,res:[],sel:null,built:[],title:u.tr,pass:Math.ceil(u.drill.length*0.8)};
  V={view:"quiz"}; window.scrollTo(0,0); render();
}
function startLevelExam(lv){
  let pool=[]; unitsOf(lv).forEach(u=>{u.drill.forEach(d=>pool.push(d));});
  pool=shuffle(pool).slice(0,10);
  Q={mode:"level",lv:lv,items:pool,i:0,res:[],sel:null,built:[],title:lv+" seviye sınavı",pass:8};
  V={view:"quiz"}; window.scrollTo(0,0); render();
}
function startPlacement(){
  Q={mode:"placement",items:PLACEMENT.map(p=>({t:"mc",q:p.q,a:p.a,c:p.c,lv:p.lv})),i:0,res:[],sel:null,built:[],title:"Seviye sınavı",pass:0};
  V={view:"quiz"}; window.scrollTo(0,0); render();
}
function renderQuiz(){
  if(Q.i>=Q.items.length)return renderScore();
  const it=Q.items[Q.i];
  if(it.t==="order"&&!Q.pool){Q.pool=shuffle(it.w);Q.used=[];Q.bidx=[];}
  let h=bar(Q.title,"Soru "+(Q.i+1)+" / "+Q.items.length,true)+'<div class="wrap">';
  h+='<div class="prog">';
  Q.items.forEach((_,i)=>{const r=Q.res[i];h+='<i class="'+(r===undefined?"":(r?"ok":"no"))+'"></i>';});
  h+='</div>';
  h+='<p class="qn">'+(it.t==="mc"?"Seç":it.t==="fill"?"Boşluğu doldur":"Cümleyi kur")+'</p>';
  h+='<p class="q">'+esc(it.q).replace(/___/g,'<span class="blank">____</span>')+'</p>';
  if(it.t==="mc"){
    it.a.forEach((o,i)=>{
      let cls="opt";
      if(Q.sel!==null){ if(i===it.c)cls+=" right"; else if(i===Q.sel)cls+=" wrong"; else cls+=" dim"; }
      h+='<button class="'+cls+'" '+(Q.sel===null?'onclick="answerMC('+i+')"':'')+'>'+esc(o)+'</button>';
    });
  }else if(it.t==="fill"){
    h+='<input class="inp" id="fin" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="yazın…" '+(Q.sel!==null?'disabled value="'+esc(Q.typed||"")+'"':'')+'>';
    if(Q.sel===null)h+='<button class="btn" onclick="answerFill()">Kontrol et</button>';
  }else{
    h+='<div class="slot" id="slot">'+Q.built.map((w,i)=>'<button class="tile" '+(Q.sel===null?'onclick="unbuild('+i+')"':'')+'>'+esc(w)+'</button>').join('')+'</div>';
    h+='<div class="tiles">';
    (Q.pool||[]).forEach((w,i)=>{h+='<button class="tile '+(Q.used&&Q.used[i]?"used":"")+'" '+(Q.sel===null?'onclick="build('+i+')"':'')+'>'+esc(w)+'</button>';});
    h+='</div>';
    if(Q.sel===null)h+='<button class="btn" onclick="answerOrder()" '+(Q.built.length?'':'disabled')+'>Kontrol et</button>';
  }
  if(Q.sel!==null){
    const ok=Q.res[Q.i];
    h+='<div class="fb '+(ok?"ok":"no")+'"><b>'+(ok?"Doğru":"Yanlış")+'</b>'+
      (ok?'':(it.t==="mc"?esc(it.a[it.c]):esc(it.c))+(it.why?' — ':''))+esc(it.why||"")+'</div>';
    h+='<button class="btn" onclick="nextQ()">'+(Q.i+1>=Q.items.length?"Sonuç":"Devam")+'</button>';
  }
  h+='</div>';
  app().innerHTML=h;
  const fin=document.getElementById("fin"); if(fin&&Q.sel===null)fin.focus();
  if(fin)fin.addEventListener("keydown",e=>{if(e.key==="Enter")answerFill();});
}
function answerMC(i){const it=Q.items[Q.i];Q.sel=i;Q.res[Q.i]=(i===it.c);render();}
function answerFill(){
  const fin=document.getElementById("fin"); if(!fin)return;
  const v=fin.value; Q.typed=v; Q.sel=0;
  const it=Q.items[Q.i];
  Q.res[Q.i]=fold(v)===fold(it.c)||fold(v).replace(/ /g,"")===fold(it.c).replace(/ /g,"");
  render();
}
function build(i){if(Q.used[i])return;Q.used[i]=1;Q.built.push(Q.pool[i]);Q.bidx=Q.bidx||[];Q.bidx.push(i);render();}
function unbuild(i){const src=Q.bidx[i];Q.used[src]=0;Q.built.splice(i,1);Q.bidx.splice(i,1);render();}
function answerOrder(){
  const it=Q.items[Q.i]; Q.sel=0;
  Q.res[Q.i]=fold(Q.built.join(" "))===fold(it.c);
  render();
}
function nextQ(){Q.i++;Q.sel=null;Q.built=[];Q.bidx=[];Q.pool=null;Q.used=[];Q.typed="";window.scrollTo(0,0);render();}
function renderScore(){
  const n=Q.res.filter(Boolean).length, of=Q.items.length;
  touchDay();
  let h=bar(Q.title,"Sonuç",true)+'<div class="wrap">';
  if(Q.mode==="placement"){
    let best=-1;
    const byLv={};
    Q.items.forEach((it,i)=>{byLv[it.lv]=byLv[it.lv]||[0,0];byLv[it.lv][1]++;if(Q.res[i])byLv[it.lv][0]++;});
    LEVELS.forEach((l,i)=>{const b=byLv[l.id];if(b&&b[0]===b[1])best=i;});
    const start=LEVELS[Math.max(0,Math.min(best+1,5))].id;
    h+='<div class="score"><div class="big">'+n+'/'+of+'</div><p class="sub">Önerilen başlangıç seviyesi</p>'+
      '<p class="mark" style="font-size:2.4rem;margin:.3rem 0">'+start+'</p></div>';
    h+='<div class="card"><p class="sub">This is a rough placement, not a certificate. You can start anywhere — and any level can be skipped with its own “test ahead” exam.</p>'+
      '<button class="btn" onclick="go(\'level\',\''+start+'\')">'+start+' ile başla</button>'+
      '<button class="btn ghost" onclick="home()">Ana sayfa</button></div>';
  }else{
    const pass=n>=Q.pass;
    h+='<div class="score"><div class="big '+(pass?"pass":"fail")+'">'+n+'/'+of+'</div>'+
      '<p class="sub">'+(pass?"Geçtiniz":"Biraz daha çalışmak gerek")+'</p></div>';
    if(pass){
      if(Q.mode==="unit"){S.done[Q.u]={score:n,of:of,at:Date.now()};}
      else{ unitsOf(Q.lv).forEach(u=>{if(!S.done[u.id])S.done[u.id]={score:n,of:of,at:Date.now(),byTest:true};}); S.tested[Q.lv]=true; }
      save();
    }else if(Q.mode==="unit"&&S.done[Q.u]&&n>S.done[Q.u].score){S.done[Q.u].score=n;save();}
    h+='<div class="card"><p class="sub">'+
      (pass? (Q.mode==="unit"?"Unit marked complete.":"Level marked complete — every unit in "+Q.lv+" is now ticked. You can still open any unit and read it.")
           : "You need "+Q.pass+" to pass. Review the section and try again — wrong answers are worth more than right ones.")+'</p>';
    if(Q.mode==="unit"){
      const u=unit(Q.u), us=unitsOf(u.lv), i=us.findIndex(x=>x.id===u.id);
      h+='<button class="btn" onclick="startUnitQuiz(\''+Q.u+'\')">Tekrar dene</button>';
      if(pass&&i<us.length-1)h+='<button class="btn ghost" onclick="go(\'unit\',\''+us[i+1].id+'\',\'v\')">Sonraki ünite →</button>';
      else h+='<button class="btn ghost" onclick="go(\'level\',\''+u.lv+'\')">Seviyeye dön</button>';
    }else{
      h+='<button class="btn" onclick="startLevelExam(\''+Q.lv+'\')">Tekrar dene</button>'+
         '<button class="btn ghost" onclick="go(\'level\',\''+Q.lv+'\')">Seviyeye dön</button>';
    }
    h+='</div>';
  }
  h+='</div>';
  app().innerHTML=h;
}

/* ===================== words ===================== */
let FC=null;
function renderWords(){
  let h=bar("Sözlüğüm","Saved words",true)+'<div class="wrap">';
  if(!S.star.length){
    h+='<div class="empty">No saved words yet.<br>Open any unit’s Kelimeler tab and tap a star.</div>';
  }else{
    h+='<div class="card"><p class="lead">'+S.star.length+' kelime · '+dueList().length+' bugün</p>'+
      '<p class="sub">Review sends each word away for longer every time you get it right. Flashcards just run the lot in random order.</p>'+
      '<button class="btn" onclick="startReview()">Tekrara başla</button>'+
      '<button class="btn ghost" onclick="startCards()">Kartlarla çalış</button></div><div class="card" style="padding:.3rem 1rem">';
    S.star.slice().reverse().forEach((k,i)=>{
      const p=k.split("|");
      h+='<div class="vrow"><button class="sbtn" onclick="sayWord(\''+p[0].replace(/'/g,"\\'")+'\')" aria-label="Listen">'+IC.spk+'</button>'+
        '<div class="grow"><div class="vtr">'+esc(p[0])+'</div><div class="ven">'+esc(p[1])+'</div></div>'+
        '<button class="star on" onclick="unstar('+(S.star.length-1-i)+')" aria-label="Remove">'+IC.star+'</button></div>';
    });
    h+='</div>';
  }
  h+='</div>';
  app().innerHTML=h;
}
function unstar(i){const k=S.star[i];S.star.splice(i,1);srsDrop(k);save();render();}
function startCards(){FC={q:shuffle(S.star),i:0,show:false};V={view:"cards"};window.scrollTo(0,0);render();}
function flip(){FC.show=!FC.show;render();}
function nextCard(){FC.i++;FC.show=false;window.scrollTo(0,0);render();}
function renderCards(){
  if(FC.i>=FC.q.length){
    app().innerHTML=bar("Kartlar","Bitti",true)+'<div class="wrap"><div class="score"><div class="big pass">'+FC.q.length+'</div><p class="sub">kelime gözden geçirildi</p></div>'+
      '<button class="btn" onclick="startCards()">Tekrar</button><button class="btn ghost" onclick="go(\'words\')">Sözlüğüm</button></div>';
    return;
  }
  const p=FC.q[FC.i].split("|");
  let h=bar("Kartlar",(FC.i+1)+" / "+FC.q.length,true)+'<div class="wrap">';
  h+='<div class="card" style="text-align:center;padding:2.6rem 1rem;min-height:190px" onclick="flip()">'+
    '<p class="mark" style="font-size:2rem;margin:0">'+esc(p[0])+'</p>'+
    '<button class="sbtn" style="margin-top:.6rem" onclick="event.stopPropagation();sayWord(\''+p[0].replace(/'/g,"\\'")+'\')">'+IC.spk+' dinle</button>'+
    (FC.show?'<p class="sub" style="margin-top:1rem;font-size:1.05rem">'+esc(p[1])+'</p>':'<p class="tiny" style="margin-top:1rem">tap to reveal</p>')+'</div>';
  h+='<div class="btn-row"><button class="btn ghost" onclick="flip()">Çevir</button><button class="btn" onclick="nextCard()">Sonraki</button></div></div>';
  app().innerHTML=h;
}

/* ===================== üretim · production ===================== */
/* Pimsleur's one move: the sentence has to leave your mouth before the
   model is heard. English prompt, a silent gap, then the Turkish and the
   learner's own verdict. No microphone — self-grading is what keeps it
   working offline with nothing to permit. Scheduling reuses STEPS, the
   same ladder the word queue climbs.
   PR holds a run and, like VOICE and Q, must survive a re-render. */
const GAPS=[3,4,5,6];
const SESSION=12;
const RETELL_NEXT=[0,2,4,0];        /* told on day 1, then 3, then 7 */
let PR=null;

function prodGap(){return S.gap||4;}
function setGap(n){S.gap=n;save();render();}
function togglePrompt(){S.prompten=!S.prompten;save();render();}
function pscope(){return S.pscope||"done";}
function setScope(s){S.pscope=s;save();render();}

/* Keys are permanent, like unit ids: "s:<unitId>#<line>" and "k:<n>". */
function sayable(t){return String(t).replace(/^[—–-]\s*/,"").trim();}
function sentenceBank(){
  const sc=pscope(), here=S.place&&S.place.u, out=[];
  let us=UNITS.filter(function(u){return sc==="all"?true:sc==="unit"?u.id===here:isDone(u.id);});
  if(!us.length)us=UNITS.slice(0,3);   /* nothing finished yet — start at the start */
  us.forEach(function(u){
    u.read.lines.forEach(function(ln,i){
      out.push({k:"s:"+u.id+"#"+i,tr:sayable(ln[0]),en:ln[1],lv:u.lv,from:u.tr});
    });
  });
  return out;
}
function chunkBank(){
  return CHUNKS.map(function(c,i){return {k:"k:"+i,tr:c[0],en:c[1],lv:"Kalıp",from:"günlük konuşma"};});
}
function prodDue(bank){
  const n=dayNum();
  return bank.filter(function(it){const r=S.prod&&S.prod[it.k];return !r||r.d<=n;});
}
/* Anything already scheduled and due comes first, oldest first; the rest
   of the session is filled with sentences never seen before. */
function prodQueue(bank){
  const n=dayNum(), old=[], fresh=[];
  bank.forEach(function(it){
    const r=S.prod&&S.prod[it.k];
    if(r){if(r.d<=n)old.push(it);}else fresh.push(it);
  });
  old.sort(function(x,y){return S.prod[x.k].d-S.prod[y.k].d;});
  /* Reviews first, oldest due first; new sentences stay in course order,
     so the mode walks the material rather than sampling it at random. */
  return old.concat(fresh).slice(0,SESSION);
}
function prodGradeKey(k,good){
  if(!S.prod)S.prod={};
  const r=S.prod[k]||{b:0,d:dayNum()};
  r.b=good?Math.min(r.b+1,STEPS.length-1):0;
  r.d=dayNum()+STEPS[r.b];
  S.prod[k]=r;save();
}

/* Backward buildup. The verb lands last in Turkish and holding the shape
   until it arrives is exactly what breaks fluency, so the tail is drilled
   first and grown leftwards:
   bilmiyorum → ne dediğini bilmiyorum → adamın ne dediğini bilmiyorum.
   Boundaries are commas, clause-opening words, and the converb and
   participle endings that close a subordinate clause. Tested folded, so
   the suffixes are written in their folded spelling. */
const OPENERS=["ne","kim","nasil","neden","niye","nicin","kac","hangi","nerede","nereye","nereden","eger","cunku","ama","fakat"];
/* Postpositions close the phrase before them, so the break goes after,
   never before: "bir süre sonra | Hoca…", not "…süre | sonra Hoca…". */
const POSTPOS=["icin","gibi","diye","sonra","once","kadar","gore","ile","ki","dolayi","beri"];
/* And nothing may open on a clitic — de/da/mi lean on the word to their left. */
const CLITIC=["de","da","ki","mi","mu","ise","bile","dahi"];
const CONVERB=/(ip|up|erek|arak|ince|inca|unca|unce|ken|madan|meden|digi|dugu|tigi|tugu|acagi|ecegi)(ni|nu|na|ne|n|)$/;
function clauseSplit(t){
  const s=sayable(t), w=s.split(/\s+/);
  if(w.length<4)return [s];
  const starts=[];
  for(let i=1;i<w.length;i++){
    const prev=fold(w[i-1]), cur=fold(w[i]);
    if(CLITIC.indexOf(cur)>-1)continue;
    if(/[,;:]$/.test(w[i-1])||OPENERS.indexOf(cur)>-1||POSTPOS.indexOf(prev)>-1||CONVERB.test(prev))starts.push(i);
  }
  /* The verb, standing alone — but never a bare clitic, so a sentence
     ending "… var mı?" starts from "var mı?" rather than "mı?". */
  let last=w.length-1;
  while(last>0&&(CLITIC.indexOf(fold(w[last]))>-1||POSTPOS.indexOf(fold(w[last]))>-1))last--;
  starts.push(last);
  const tails=[];
  starts.sort(function(x,y){return y-x;}).forEach(function(i){
    const t2=w.slice(i).join(" ");
    if(tails.indexOf(t2)<0)tails.push(t2);
  });
  const out=tails.slice(0,3);
  if(out.indexOf(s)<0)out.push(s);
  return out;
}

/* --- the run --------------------------------------------------------- */
function prodStop(){if(PR&&PR.tid){clearTimeout(PR.tid);PR.tid=null;}}
function startProd(mode){
  stopPlay();
  const q=prodQueue(mode==="k"?chunkBank():sentenceBank());
  if(!q.length){V={view:"prod"};render();return;}
  PR={mode:mode,q:q,i:0,phase:"gap",left:prodGap(),tid:null,right:0,build:null,bi:0};
  V={view:"prodrun"};window.scrollTo(0,0);
  touchDay();prodStep();
}
function prodStep(){
  if(!PR)return;
  const it=PR.q[PR.i];
  if(!it){PR.phase="end";render();return;}
  PR.phase="gap";PR.left=prodGap();PR.build=null;PR.bi=0;
  render();
  if(S.prompten)say(it.en,0.95,null,"en-GB");
  prodCount();
}
function prodCount(){
  if(!PR||PR.phase!=="gap")return;
  const el=document.getElementById("pcount");
  if(el)el.textContent=PR.left;
  if(PR.left<=0){prodModel();return;}
  PR.tid=setTimeout(function(){if(!PR||PR.phase!=="gap")return;PR.left--;prodCount();},1000);
}
function prodModel(){
  prodStop();
  if(!PR)return;
  PR.phase="model";render();
  const it=PR.q[PR.i];if(it)say(it.tr);
}
function prodSay(){const it=PR&&PR.q[PR.i];if(it)say(it.tr);}
function prodMark(good){
  const it=PR&&PR.q[PR.i];if(!it)return;
  prodGradeKey(it.k,good);
  if(good)PR.right++;
  /* A sentence you could not produce is the one worth building up. */
  if(!good&&clauseSplit(it.tr).length>1){prodBuild();return;}
  prodNext();
}
function prodBuild(){
  prodStop();
  if(!PR)return;
  PR.phase="build";PR.build=clauseSplit(PR.q[PR.i].tr);PR.bi=0;
  render();say(PR.build[0]);
}
function prodBuildNext(){
  if(!PR||!PR.build)return;
  PR.bi++;
  if(PR.bi>=PR.build.length){prodNext();return;}
  render();say(PR.build[PR.bi]);
}
function prodNext(){
  prodStop();
  if(!PR)return;
  PR.i++;window.scrollTo(0,0);
  if(PR.i>=PR.q.length){PR.phase="end";render();return;}
  prodStep();
}

/* --- say it three times ---------------------------------------------- */
function retellDue(){
  const n=dayNum();
  return UNITS.filter(function(u){const r=S.retell&&S.retell[u.id];return r&&r.n<3&&r.d<=n;});
}
function retellOpen(){
  return UNITS.filter(function(u){const r=S.retell&&S.retell[u.id];return r&&r.n<3;});
}
function startRetell(uid){
  stopPlay();
  if(!S.retell)S.retell={};
  if(!S.retell[uid])S.retell[uid]={n:0,d:dayNum()};
  save();V={view:"retell",u:uid};window.scrollTo(0,0);render();
}
function retellDone(uid){
  const r=(S.retell&&S.retell[uid])||{n:0,d:dayNum()};
  r.n=Math.min(r.n+1,3);
  r.d=dayNum()+RETELL_NEXT[r.n];
  S.retell[uid]=r;save();touchDay();render();
}
function retellReset(uid){S.retell[uid]={n:0,d:dayNum()};save();render();}

/* --- screens ---------------------------------------------------------- */
function renderProd(){
  const sb=sentenceBank(), sd=prodDue(sb).length, kd=prodDue(chunkBank()).length;
  const rd=retellDue().length, open=retellOpen(), g=prodGap();
  let h=bar("Üretim","production · speak first",true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">The prompt is English. You say the Turkish out loud in the silence, <b>before</b> the model plays — then mark yourself. Nothing is recorded and no microphone is used.</p>';
  h+='<div class="stat"><div><b>'+sd+'</b><span>cümle</span></div>'+
     '<div><b>'+kd+'</b><span>kalıp</span></div>'+
     '<div><b>'+rd+'</b><span>anlatım</span></div></div>';

  h+='<h2 class="sec">Çalış</h2>';
  h+='<div class="card"><p class="lead">Cümleler</p><p class="sub">'+sb.length+' sentence'+(sb.length===1?"":"s")+' in range · '+sd+' due today. Up to '+SESSION+' in a sitting.</p>'+
   '<button class="btn" onclick="startProd(\'s\')">Başla</button></div>';
  h+='<div class="card"><p class="lead">Kalıplar</p><p class="sub">'+CHUNKS.length+' conversational prefabs — the ready-made pieces a speaker reaches for before composing anything. '+kd+' due today.</p>'+
   '<button class="btn" onclick="startProd(\'k\')">Başla</button></div>';

  h+='<h2 class="sec">Üç kez anlat</h2><div class="card">';
  h+='<p class="sub">A unit\'s speaking task, told from memory three times: today, in two days, and in a week. Start one from any unit\'s Konuşma card.</p>';
  if(open.length){
    open.forEach(function(u){
      const r=S.retell[u.id], left=r.d-dayNum();
      h+='<button class="unit" onclick="startRetell(\''+u.id+'\')"><span class="tick '+(left<=0?"here":"")+'">'+r.n+'</span>'+
        '<span class="grow"><span class="unit-t">'+esc(u.tr)+'</span><span class="unit-s">'+esc(u.lv)+' · '+
        (left<=0?"bugün":left+" gün sonra")+' · '+r.n+'/3</span></span><span class="chev">'+IC.chev+'</span></button>';
    });
  }else h+='<p class="tiny">Nothing started yet.</p>';
  h+='</div>';

  h+='<h2 class="sec">Ayarlar</h2><div class="card">';
  h+='<p class="lead" style="font-size:.95rem">Sessizlik · the gap</p>'+
   '<p class="sub">How long you get before the model plays.</p><div class="segs">';
  GAPS.forEach(function(n){h+='<button class="'+(n===g?"on":"")+'" onclick="setGap('+n+')">'+n+'<i>saniye</i></button>';});
  h+='</div>';
  h+='<p class="lead" style="font-size:.95rem">Kaynak · where sentences come from</p><div class="segs">';
  [["done","Tamamlanan","finished"],["unit","Bu ünite","bookmark"],["all","Tümü","all 60"]].forEach(function(s){
    h+='<button class="'+(pscope()===s[0]?"on":"")+'" onclick="setScope(\''+s[0]+'\')">'+s[1]+'<i>'+s[2]+'</i></button>';
  });
  h+='</div>';
  h+='<button class="btn ghost" onclick="togglePrompt()">'+(S.prompten?"İngilizce sesli ✓":"İngilizceyi de seslendir")+'</button>';
  h+='<p class="tiny" style="margin-top:.5rem">The English prompt is read by whatever English voice the device has. Leave it off to read it yourself and keep the silence longer.</p>';
  h+='</div>';

  h+='<p class="foot">Right answers come back later and later — 1, 2, 4, 8, 16 days — on the same ladder as the word queue. Wrong ones come back today.</p></div>';
  app().innerHTML=h;
}

function renderProdRun(){
  if(!PR){renderProd();return;}
  if(PR.phase==="end"){
    const left=prodDue(PR.mode==="k"?chunkBank():sentenceBank()).length;
    app().innerHTML=bar("Üretim","Bitti",true)+'<div class="wrap"><div class="score">'+
      '<div class="big '+(PR.right*2>=PR.q.length?"pass":"fail")+'">'+PR.right+'/'+PR.q.length+'</div>'+
      '<p class="sub">kendi değerlendirmen · your own marking</p></div>'+
      '<div class="card"><p class="sub">'+left+' still waiting in this set. The ones you missed come back today.</p>'+
      '<button class="btn" onclick="startProd(\''+PR.mode+'\')">Devam</button>'+
      '<button class="btn ghost" onclick="go(\'prod\')">Üretim</button></div></div>';
    return;
  }
  const it=PR.q[PR.i];
  let h=bar("Üretim",(PR.i+1)+" / "+PR.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+PR.q.map(function(_,i){return '<i class="'+(i<PR.i?"ok":"")+'"></i>';}).join('')+'</div>';
  h+='<p class="qn">'+(PR.phase==="build"?"Sondan başa · backward buildup":"Söyle · say it")+'</p>';
  h+='<div class="card" style="text-align:center;padding:1.8rem 1rem">';
  h+='<p class="sub" style="font-size:1.05rem;margin:0">'+esc(it.en)+'</p>';
  if(PR.phase==="gap"){
    h+='<p class="mark" id="pcount" style="font-size:3rem;margin:.8rem 0 .1rem;color:var(--turk)">'+PR.left+'</p>'+
     '<p class="tiny">Şimdi yüksek sesle söyle · say it out loud now</p>';
  }else if(PR.phase==="model"){
    h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.6rem;line-height:1.35;margin:.8rem 0 0">'+esc(it.tr)+'</p>'+
     '<button class="sbtn" style="margin-top:.6rem" onclick="prodSay()">'+IC.spk+' tekrar</button>';
  }else{
    h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.5rem;line-height:1.35;margin:.8rem 0 0">'+esc(PR.build[PR.bi])+'</p>'+
     '<p class="tiny" style="margin-top:.5rem">'+(PR.bi+1)+' / '+PR.build.length+' · repeat this piece, then take the next</p>';
  }
  h+='</div>';
  h+='<p class="tiny" style="text-align:center">'+esc(it.lv+" · "+it.from)+'</p>';
  if(PR.phase==="gap")h+='<button class="btn ghost" onclick="prodModel()">Şimdi göster</button>';
  else if(PR.phase==="model"){
    h+='<div class="btn-row"><button class="btn ghost" onclick="prodMark(false)">Yanlış</button>'+
     '<button class="btn" onclick="prodMark(true)">Doğru</button></div>';
    if(clauseSplit(it.tr).length>1)h+='<button class="btn ghost" onclick="prodBuild()">Sondan başa kur</button>';
  }else h+='<button class="btn" onclick="prodBuildNext()">'+(PR.bi+1>=PR.build.length?"Bitir":"Sonraki parça")+'</button>';
  h+='</div>';
  app().innerHTML=h;
}

function renderRetell(){
  const u=unit(V.u), r=(S.retell&&S.retell[u.id])||{n:0,d:dayNum()};
  const all=r.n>=3, now=r.d<=dayNum(), left=Math.max(0,r.d-dayNum());
  let h=bar("Anlat",u.lv+" · "+u.tr,true)+'<div class="wrap">';
  h+='<div class="card"><p class="tiny">Konuşma görevi · the speaking task</p>'+
   '<p class="lead" style="margin-top:.2rem">'+esc(u.speak)+'</p></div>';
  h+='<div class="stat"><div><b>'+r.n+'/3</b><span>anlatıldı</span></div>'+
   '<div><b>'+(all?"✓":(now?"bugün":left+" gün"))+'</b><span>'+(all?"tamam":"sıradaki")+'</span></div></div>';
  h+='<div class="card"><p class="sub">Say the whole thing out loud, from memory, without reading the passage. These are the ten words the unit gave you.</p>'+
   '<div class="pillrow">';
  u.vocab.forEach(function(w){h+='<span class="pill">'+esc(w[0])+'</span>';});
  h+='</div></div>';
  if(all)h+='<div class="card"><p class="lead">Üç kez anlatıldı ✓</p>'+
   '<p class="sub">Told on day one, day three and day seven. Start it again whenever you like.</p>'+
   '<button class="btn ghost" onclick="retellReset(\''+u.id+'\')">Baştan</button></div>';
  else if(now)h+='<button class="btn" onclick="retellDone(\''+u.id+'\')">Anlattım</button>';
  else h+='<div class="card"><p class="sub">Not due yet — it comes back on its own in '+left+' day'+(left===1?"":"s")+'. Telling it again today is not what makes it stick.</p>'+
   '<button class="btn ghost" onclick="retellDone(\''+u.id+'\')">Yine de anlattım</button></div>';
  h+='<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'r\')">Üniteye dön</button></div>';
  app().innerHTML=h;
}

/* ===================== about ===================== */
function renderAbout(){
  let h=bar("Bu kurs hakkında","About",true)+'<div class="wrap"><div class="card gram">'+
  '<p class="lead">Nasıl çalışır</p>'+
  '<p>Six CEFR levels, ten units each — sixty in all. Every unit has four parts: <b>Kelimeler</b> (ten words you can save), <b>Dilbilgisi</b> (one grammar point with a table and examples), <b>Okuma</b> (a graded passage, tap any line for the English), and <b>Alıştırma</b> (five questions).</p>'+
  '<p class="lead" style="margin-top:1.3rem">Ses · listening and shadowing</p>'+'<p>Every reading passage has a <b>Dinle</b> button (it reads the whole text aloud, line by line, at the speed you choose) and a <b>Gölge</b> button for shadowing: each line plays, then the app waits exactly as long again for you to repeat it out loud. Tap any single line’s speaker to hear just that line, and any vocabulary word to hear it alone.</p>'+'<p>This uses your device’s own Turkish voice. If nothing is heard, your phone has no Turkish voice installed — on Android add it under Settings → Languages → Text-to-speech; on iOS it is usually already there.</p>'+'<p class="lead" style="margin-top:1.3rem">Tekrar · the review queue</p>'+'<p>Starred words enter a spaced queue. Grade a word <b>Zor</b> and it returns today; <b>İyi</b> and it returns later each time — 1, 2, 4, 8, 16 days and on. The home screen shows what is due.</p>'+'<p class="lead" style="margin-top:1.3rem">Üretim · saying it first</p>'+'<p>Reading and listening are not speaking. <b>Üretim</b> gives you the English, then a silence of a few seconds, and only then plays the Turkish — so the sentence has to leave your mouth before you hear the model. You mark yourself <b>Doğru</b> or <b>Yanlış</b>, and the sentences ride the same widening schedule as the words.</p>'+'<p>Long sentences can be built <b>backwards</b>, from the end forwards: <i>bilmiyorum → ne dediğini bilmiyorum → adamın ne dediğini bilmiyorum</i>. The verb lands last in Turkish, and holding the shape until it arrives is the thing that breaks fluency. A sentence you mark wrong is offered this way automatically.</p>'+'<p>Alongside the course’s own sentences there is a bank of fifty <b>kalıplar</b> — the conversational prefabs you reach for whole — and <b>üç kez anlat</b>, which brings a unit’s speaking task back on day one, day three and day seven. Nothing is recorded and no microphone is used: you are the judge, which is also what keeps it working offline.</p>'+'<p>A unit is ticked when you answer 80% of its questions correctly. Each level also has a <b>test ahead</b> exam: ten questions drawn from the whole level, and eight correct marks the level complete — so nothing you already know has to be sat through.</p>'+
  '<p>Your place is kept automatically; the home screen offers to resume it. Everything is stored in this browser only, so clearing site data clears your progress.</p>'+
  '<p class="lead" style="margin-top:1.3rem">Metinler · the texts</p>'+
  '<p>The reading difficulty climbs deliberately: invented dialogue at A1, anonymous folk tales at A2–B1, adapted short stories and essays at B2–C1, and Ottoman-era and mystical prose at C2.</p>'+
  '<p>Each passage says what it is. <b>Özgün metin</b> — written for this course. <b>Sadeleştirilmiş / yeniden anlatım</b> — anonymous folklore (Nasreddin Hoca, Keloğlan, Dede Korkut) retold in simplified Turkish. <b>Uyarlama</b> — a public-domain work (Ömer Seyfettin, Evliya Çelebi, Ziya Gökalp, Sabahattin Ali, the Mesnevî) whose situation and argument are retold here in graded modern Turkish rather than quoted.</p>'+
  '<p>If you want the originals, they are worth reading whole: Seyfettin’s <i>Kaşağı</i> and <i>Forsa</i>, Sabahattin Ali’s <i>Kürk Mantolu Madonna</i>, the <i>Dede Korkut Kitabı</i>, Evliya Çelebi’s <i>Seyahatnâme</i>.</p>'+
  '</div>'+
  '<div class="card"><p class="lead">Yedekle · back up</p>'+
  '<p class="sub">Progress lives in this browser only. Copy the text below and keep it somewhere — pasting it back restores everything, including on another device or another copy of the app.</p>'+
  '<textarea class="inp" id="iobox" rows="3" spellcheck="false" placeholder="yedek metni buraya yapıştırın…"></textarea>'+
  '<div class="btn-row"><button class="btn ghost" onclick="exportBox()">Yedeği al</button>'+
  '<button class="btn" onclick="importBox()">Geri yükle</button></div>'+
  '<p class="tiny" id="iomsg" style="margin-top:.5rem"></p></div>'+
  '<div class="card"><p class="lead">Sıfırla</p><p class="sub">Clear all progress, saved words and bookmarks on this device.</p>'+
  '<button class="btn ghost" onclick="wipe()">Tüm ilerlemeyi sil</button></div>'+
  '<p class="foot">Türkçe '+APP_VERSION+' · '+UNITS.length+' ünite · '+LEVELS.length+' seviye</p></div>';
  app().innerHTML=h;
}

function ioMsg(t){const e=document.getElementById("iomsg");if(e)e.textContent=t;}
function exportBox(){
  const box=document.getElementById("iobox"); if(!box)return;
  box.value=JSON.stringify(S);
  try{box.select();}catch(e){}
  let done=false;
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(box.value);done=true;}}catch(e){}
  if(!done){try{done=document.execCommand("copy");}catch(e){}}
  ioMsg(done?"Kopyalandı · copied. Paste it somewhere safe.":"Yedek aşağıda · select the text above and copy it.");
}
function importBox(){
  const box=document.getElementById("iobox"); if(!box)return;
  const raw=(box.value||"").trim();
  if(!raw){ioMsg("Önce yedek metnini yapıştırın · paste a backup first.");return;}
  let o=null;
  try{o=JSON.parse(raw);}catch(e){}
  if(!o||typeof o!=="object"||Array.isArray(o)){ioMsg("Bu metin okunamadı · that text could not be read.");return;}
  S=Object.assign({done:{},seen:{},place:null,star:[],tested:{},days:[],srs:{},theme:S.theme,rate:S.rate,
                   prod:{},retell:{},gap:S.gap,prompten:S.prompten,pscope:S.pscope},o);
  if(!S.done)S.done={}; if(!S.star)S.star=[]; if(!S.srs)S.srs={}; if(!S.seen)S.seen={};
  if(!S.tested)S.tested={}; if(!S.days)S.days=[];
  if(!S.prod)S.prod={}; if(!S.retell)S.retell={};
  save();
  if(S.rate)VOICE.rate=S.rate;
  home();
}
function wipe(){
  if(typeof confirm==="function"&&!confirm("Delete all progress, saved words and your place? This cannot be undone."))return;
  S={done:{},seen:{},place:null,star:[],tested:{},days:[],theme:S.theme,srs:{},rate:S.rate,
     prod:{},retell:{},gap:S.gap,prompten:S.prompten,pscope:S.pscope};
  save(); home();
}

/* ===================== boot ===================== */
function render(){
  const v=V.view;
  if(v==="home")renderHome();
  else if(v==="level")renderLevel();
  else if(v==="unit")renderUnit();
  else if(v==="quiz")renderQuiz();
  else if(v==="words")renderWords();
  else if(v==="cards")renderCards();
  else if(v==="review")renderReview();
  else if(v==="about")renderAbout();
  else if(v==="prod")renderProd();
  else if(v==="prodrun")renderProdRun();
  else if(v==="retell")renderRetell();
  else renderHome();
}
if(typeof navigator!=="undefined"&&navigator.serviceWorker&&typeof location!=="undefined"&&/^https?:/.test(location.protocol)){
  try{navigator.serviceWorker.register("sw.js").catch(function(){});}catch(e){}
}
load();
if(S.rate)VOICE.rate=S.rate;
if(S.theme)document.documentElement.setAttribute("data-theme",S.theme);
touchDay();
render();
