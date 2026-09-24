/* Adım adım: an A1 unit one screen at a time.

   A unit is four tabs a learner moves between freely, which is right for
   someone who knows what they want and easy to drift through for someone
   who does not: a skimmed word list, a grammar tab never opened, no clear
   moment when the unit is done. This walks the same material in order —
   the ten words, each heard and pictured; a quick listening check and
   three spellings from letter tiles; the grammar point; the passage a
   line at a time — and hands over to the unit's own five exercises, which
   are what tick it. Borrowed from the children's app, where it is the
   whole shape.

   It adds no material and no storage: each part marks its tab seen as it
   is shown (markSeen, the same record the tabs write), so the reviews
   open exactly as if the tabs had been read. The checks are practice,
   not marks — nothing is scheduled or put in the mistake book, and one
   missed comes back at the end. The tabs stay; this is a second way in.
   AD holds a run and, like Q and PR, survives a re-render. */

/* ===================== adım adım · step by step ===================== */
const ADIM_LV=["A1"];
const ADIM_RETRY=2;
let AD=null;
function adimFor(u){return !!u&&ADIM_LV.indexOf(u.lv)>-1;}
function adimWords(u){
  return u.vocab.map(function(w,i){
    return {i:i,tr:w[0],say:vocabPrimary(w[0]).replace(/[?.!]+$/,""),en:w[1],em:RESIM[w[0]]||""};
  });
}
function adimSpellable(w){return /^[a-zçğıöşüâîû]+$/.test(w.say)&&w.say.length<=10;}
function adimSteps(u){
  const W=adimWords(u), steps=W.map(function(w){return {t:"word",w:w};});
  shuffle(W).slice(0,4).forEach(function(w){
    steps.push({t:"hear",w:w,opts:shuffle(shuffle(W.filter(function(x){return x.i!==w.i;})).slice(0,3).concat([w]))});
  });
  shuffle(W.filter(adimSpellable)).slice(0,3).forEach(function(w){steps.push({t:"spell",w:w,tiles:spellTiles(w.say)});});
  steps.push({t:"gram"});
  u.read.lines.forEach(function(l,i){steps.push({t:"line",i:i});});
  steps.push({t:"end"});
  steps.forEach(function(s,i){s.id=i;});
  return steps;
}
function startAdim(id){
  const u=unit(id); if(!adimFor(u)||!unitOpen(id))return;
  stopPlay();
  AD={u:id,q:adimSteps(u),i:0,phase:"ask",sel:null,built:[],ok:null,shown:false,heard:{},tries:{}};
  V={view:"adim",u:id};window.scrollTo(0,0);touchDay();render();
}
function adCur(){return AD&&AD.q[AD.i];}
function adNext(){
  if(!AD)return;
  stopPlay();
  AD.i=Math.min(AD.i+1,AD.q.length-1);
  AD.phase="ask";AD.sel=null;AD.built=[];AD.ok=null;AD.shown=false;
  window.scrollTo(0,0);render();
}
/* A missed check goes to the back of the line, before the grammar, so
   the words are settled before the unit moves on from them. */
function adJudge(ok){
  const s=adCur(); if(!s)return;
  const n=(AD.tries[s.id]=(AD.tries[s.id]||0)+1);
  if(!ok&&n<=ADIM_RETRY){
    const again=Object.assign({},s,{retry:true});
    if(again.opts)again.opts=shuffle(again.opts);
    if(again.tiles)again.tiles=shuffle(again.tiles);
    const at=AD.q.findIndex(function(x){return x.t==="gram";});
    AD.q.splice(at,0,again);
  }
  AD.ok=ok;AD.phase="fb";render();
  if(s.t!=="hear")say(s.w.say,0.85);
}
function adPick(i){const s=adCur(); if(!s||AD.phase!=="ask")return; AD.sel=i; adJudge(i===s.w.i);}
function adAdd(i){if(!AD||AD.phase!=="ask"||AD.built.indexOf(i)>-1)return; AD.built.push(i); render();}
function adDel(j){if(!AD||AD.phase!=="ask")return; AD.built.splice(j,1); render();}
function adSpell(){
  const s=adCur(); if(!s||!AD.built.length)return;
  adJudge(AD.built.map(function(i){return s.tiles[i];}).join("")===s.w.say);
}
function adShow(){if(AD){AD.shown=true;render();}}

function renderAdim(){
  if(!AD){home();return;}
  const u=unit(AD.u), s=adCur();
  if(!u||!s){go("unit",AD.u,"v");return;}
  if(s.t==="word"&&!(S.seen[u.id]&&S.seen[u.id].v))markSeen(u.id,"v");
  if(s.t==="gram"&&!(S.seen[u.id]&&S.seen[u.id].g))markSeen(u.id,"g");
  if(s.t==="line"&&!(S.seen[u.id]&&S.seen[u.id].r))markSeen(u.id,"r");
  let h=bar(u.tr,u.lv+" · Ünite "+u.n+" · adım adım",true)+'<div class="wrap">';
  h+='<div class="abar"><i style="width:'+Math.round(100*AD.i/(AD.q.length-1))+'%"></i></div>';
  if(s.t==="word"){
    h+='<p class="qn">Yeni kelime</p><div class="card adw">'+(s.w.em?'<div class="pic">'+s.w.em+'</div>':'')+
      '<div class="vtr">'+esc(s.w.tr)+'</div><div class="ven">'+esc(s.w.en)+'</div>'+spkBtn(s.w.say,{aria:"Listen"})+'</div>'+
      '<button class="btn" onclick="adNext()">Devam</button>';
  }else if(s.t==="hear"){
    h+='<p class="qn">Ne duydun?</p><div class="adw">'+spkBtn(s.w.say,{aria:"Listen",style:"width:64px;height:64px"})+'</div><div class="adopts">';
    s.opts.forEach(function(o){
      const cls=AD.phase==="ask"?"":o.i===s.w.i?" right":o.i===AD.sel?" wrong":" dim";
      h+='<button class="opt'+cls+'" '+(AD.phase==="ask"?'onclick="adPick('+o.i+')"':'')+'>'+(o.em?'<span class="pic sm">'+o.em+'</span>':'')+esc(o.en)+'</button>';
    });
    h+='</div>';
  }else if(s.t==="spell"){
    h+='<p class="qn">Harfleri diz</p><div class="card adw">'+(s.w.em?'<div class="pic">'+s.w.em+'</div>':'')+'<div class="ven">'+esc(s.w.en)+'</div>'+spkBtn(s.w.say,{aria:"Listen"})+'</div>';
    h+='<div class="slot">'+AD.built.map(function(i,j){return '<button class="tile" '+(AD.phase==="ask"?'onclick="adDel('+j+')"':'')+'>'+esc(s.tiles[i])+'</button>';}).join("")+'</div><div class="tiles">';
    s.tiles.forEach(function(t,i){h+='<button class="tile'+(AD.built.indexOf(i)>-1?" used":"")+'" '+(AD.phase==="ask"&&AD.built.indexOf(i)<0?'onclick="adAdd('+i+')"':'')+'>'+esc(t)+'</button>';});
    h+='</div>';
    if(AD.phase==="ask")h+='<button class="btn" onclick="adSpell()" '+(AD.built.length?'':'disabled')+'>Kontrol et</button>';
  }else if(s.t==="gram"){
    h+='<p class="qn">Dilbilgisi</p>'+gramCard(u)+spokenCard(u)+'<button class="btn" onclick="adNext()">Devam</button>';
  }else if(s.t==="line"){
    const ln=u.read.lines[s.i];
    h+='<p class="qn">Okuma</p><p class="src" style="margin:0 .2rem .6rem"><b>'+esc(u.read.t)+'</b> · '+(s.i+1)+' / '+u.read.lines.length+'</p>'+
      '<div class="card adl"><p class="adtr">'+glossify(ln[0],u.read.gloss)+'</p>'+spkBtn(ln[0],{aria:"Listen"})+
      (AD.shown?'<p class="aden">'+esc(ln[1])+'</p>':'')+'</div>'+
      (AD.shown?'':'<button class="btn ghost" onclick="adShow()">İngilizcesi</button>')+
      '<button class="btn" onclick="adNext()">Devam</button>';
  }else{
    h+='<div class="score"><div class="big pass">✓</div><p class="sub">Alıştırmalara hazırsın</p></div>'+
      '<div class="card"><p class="sub">You have met the ten words, the grammar point and the whole passage. The five exercises tick the unit: four right out of five.</p>'+
      '<button class="btn" onclick="startUnitQuiz(\''+u.id+'\')">Alıştırmalara geç →</button>'+
      '<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'v\')">Üniteye dön</button></div>';
  }
  if(AD.phase==="fb"){
    const w=s.w;
    h+='<div class="fb '+(AD.ok?"ok":"no")+'"><b>'+(AD.ok?"Doğru":"Yanlış")+'</b>'+(w.em?' '+w.em:'')+' '+esc(w.say)+' — '+esc(w.en)+
      (AD.ok?'':'<br><span class="tiny">This one comes back before the grammar.</span>')+'</div>'+
      '<button class="btn" onclick="adNext()">Devam</button>';
  }
  h+='</div>';
  paint(h);
  /* A word or a line plays as it arrives, once; a redraw after a tap
     must not play it again. */
  if(AD.phase==="ask"&&!AD.heard[AD.i]&&(s.t==="word"||s.t==="hear"||s.t==="line")){
    AD.heard[AD.i]=1;
    say(s.t==="line"?u.read.lines[s.i][0]:s.w.say,s.t==="line"?VOICE.rate:0.8);
  }
}
