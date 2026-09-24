/* Türkçe Macera — state, helpers and routing. fold(), esc(), the voice
   and the review ladder come from src/shared/, the same code the course
   uses, so a fix there reaches both apps. Nothing here draws a screen. */

/* ===================== macera · app ===================== */
const KAPP_VERSION="k1.00";

/* ===================== macera · storage ===================== */
/* Its own key: a child's progress and a grown-up's course never share a
   save, and wiping one cannot touch the other. Unit ids and word
   positions are permanent, as in the course — see units.js. */
const KKEY="turkce-kids-v1";
let S={name:"",u:{},srs:{},xp:0,days:[],theme:null,snd:true};
let SAVEFAIL=false;
function load(){
  try{const r=localStorage.getItem(KKEY); if(r){const o=JSON.parse(r); if(o&&typeof o==="object")S=Object.assign(S,o);}}
  catch(e){SAVEFAIL=true;}
  if(!S.u)S.u={}; if(!S.srs)S.srs={}; if(!S.days)S.days=[];
  if(typeof S.xp!=="number")S.xp=0;
}
function save(){try{localStorage.setItem(KKEY,JSON.stringify(S));SAVEFAIL=false;}catch(e){SAVEFAIL=true;}}

/* ===================== macera · helpers ===================== */
const app=()=>document.getElementById("app");
function paint(h){app().innerHTML=h;}
function jsq(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function touchDay(){const t=today(); if(S.days[S.days.length-1]!==t){S.days.push(t); if(S.days.length>400)S.days=S.days.slice(-400); save();}}
function streak(){
  if(!S.days.length)return 0;
  const set=new Set(S.days), d=new Date();
  const key=x=>x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  if(!set.has(key(d)))d.setDate(d.getDate()-1);
  let n=0; while(set.has(key(d))){n++;d.setDate(d.getDate()-1);}
  return n;
}
/* A label is Turkish with its English underneath — always, at this age. */
function lbl(tr,en){return esc(tr)+(en?'<small>'+esc(en)+'</small>':'');}

/* ===================== macera · units and progress ===================== */
/* S.u[id] = {l:[stars,stars,stars], cup:{at,score}|null}. Stars 0–3 per
   lesson; cup is the trophy, which is what opens the next unit. */
function kunit(id){return KUNITS.find(function(u){return u.id===id;});}
function kidx(id){return KUNITS.findIndex(function(u){return u.id===id;});}
function prog(id){const p=S.u[id];return {l:(p&&p.l)||[0,0,0],cup:(p&&p.cup)||null};}
function setProg(id,p){S.u[id]={l:p.l.slice(),cup:p.cup||null};}
function cupWon(id){return !!prog(id).cup;}
function started(id){const p=prog(id);return !!p.cup||p.l.some(Boolean);}
/* The map opens in order, as the course does: the next unit when this
   one's trophy is won. Nothing reached is ever locked again. */
function unitOpen(id){
  const i=kidx(id); if(i<0)return false;
  if(i===0||started(id))return true;
  return cupWon(KUNITS[i-1].id);
}
function lessonOpen(id,n){
  if(!unitOpen(id))return false;
  return n===0||prog(id).l[n-1]>0;
}
function unitStars(id){return prog(id).l.reduce(function(a,b){return a+b;},0);}
function wordsOf(u){return u.words.map(function(w,i){return {u:u.id,i:i,k:u.id+"#"+i,tr:w[0],en:w[1],em:w[2]};});}
/* Words the child has met: the first lesson done, or the trophy won. */
function metWords(){
  let out=[];
  KUNITS.forEach(function(u){if(prog(u.id).l[0]>0||cupWon(u.id))out=out.concat(wordsOf(u));});
  return out;
}
const KNEW_DAY=10, KREVIEW=10;
function reviewDue(){return dueItems(S.srs,metWords(),KNEW_DAY);}
function nextStep(){
  for(let i=0;i<KUNITS.length;i++){
    const u=KUNITS[i];
    if(!unitOpen(u.id))return null;
    const p=prog(u.id);
    for(let n=0;n<3;n++)if(!p.l[n])return {u:u,n:n};
    if(!p.cup)return {u:u,n:3};
  }
  return null;
}

/* ===================== macera · points ===================== */
/* Ten for a first-try answer, five for one got right the second time.
   The ranks are animals, because a twelve-year-old will say "I'm a fox
   now" and will not say "I reached level three". */
const RANKS=[[0,"Yavru kedi","kitten","🐱"],[150,"Tilki","fox","🦊"],[400,"Kartal","eagle","🦅"],
             [800,"Aslan","lion","🦁"],[1400,"Ejderha","dragon","🐉"]];
function rank(){let r=RANKS[0];RANKS.forEach(function(x){if(S.xp>=x[0])r=x;});return r;}
function nextRank(){return RANKS.find(function(x){return x[0]>S.xp;})||null;}

/* ===================== macera · sound ===================== */
/* A small chime on an answer, made on the spot — the app carries no audio
   files. Wrapped: a browser without Web Audio simply stays quiet. */
let ACX=null;
function chime(good){
  if(!S.snd)return;
  try{
    ACX=ACX||new (window.AudioContext||window.webkitAudioContext)();
    const notes=good?[660,880]:[220];
    notes.forEach(function(f,i){
      const o=ACX.createOscillator(), g=ACX.createGain(), t=ACX.currentTime+i*0.11;
      o.frequency.value=f; o.type="sine";
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.12,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
      o.connect(g); g.connect(ACX.destination); o.start(t); o.stop(t+0.3);
    });
  }catch(e){}
}
function sayW(t){stopPlay();say(t,0.8);}

/* ===================== macera · routing ===================== */
let V={view:"home"};
function stopPlay(){
  gameStop();
  if(ttsOK()){try{speechSynthesis.cancel();}catch(e){}}
}
function go(view,a){stopPlay();V={view:view,u:a};window.scrollTo(0,0);render();}
function home(){go("home");}
function back(){
  if(V.view==="play"&&G&&G.u&&!G.done){go("unit",G.u);return;}
  if(V.view==="play"&&G&&G.u){go("unit",G.u);return;}
  home();
}
function themeDark(){
  const cur=document.documentElement.getAttribute("data-theme");
  return cur?cur==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function toggleTheme(){
  const dark=themeDark();
  document.documentElement.setAttribute("data-theme",dark?"light":"dark");
  S.theme=dark?"light":"dark"; save(); render();
}
