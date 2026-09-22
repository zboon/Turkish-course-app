/* Screens: home, a level, a unit and its four sections, the quiz
   engine, the saved-word queue, the word list, and About. */

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
  /* \u062A\u0631\u0643\u062C\u0647 is Türkçe in the Ottoman script, written as
     escapes so a right-to-left run does not scramble this line in an editor. */
  h+='<div class="wrap"><div class="hero">'+crest(76)+
   '<h1 class="mark">Türkçe</h1>'+
   '<p class="osm" dir="rtl" lang="ota" translate="no">\u062A\u0631\u0643\u062C\u0647</p>'+
   '<p class="tag">A reading course from first words to literature</p></div>';

  /* Read-then-act on day one; reference-after-action once under way. */
  if(metUnits().length===0){ h+=startCard(); h+=planCard(); }
  else { h+=planCard(); h+=startCard(); }
  h+=road;

  h+='<div class="stat"><div><b>'+UNITS.filter(u=>isDone(u.id)).length+'</b><span>units done</span></div>'+
     '<div><b>'+streak()+'</b><span>day streak</span></div>'+
     '<div><b>'+S.star.length+'</b><span>saved words</span></div></div>';


  h+='<h2 class="sec">Seviyeler</h2>';
  LEVELS.forEach(l=>{
    const p=lvPct(l.id), t=S.tested[l.id];
    h+='<button class="card" onclick="go(\'level\',\''+l.id+'\')"><div class="row">'+
      '<span class="lvl-badge '+(p===100?"on":(t?"tested":""))+'">'+l.id+'</span>'+
      '<div class="grow"><p class="lead">'+esc(l.tr)+'</p><p class="sub">'+esc(l.en)+' · '+lvDone(l.id)+'/'+unitsOf(l.id).length+' ünite</p></div>'+
      '<span class="chev">'+IC.chev+'</span></div><div class="meter"><i style="width:'+p+'%"></i></div></button>';
  });

  /* Two "N waiting" cards used to live here, from before Bugün existed.
     They duplicated the plan's own Tekrar and Söyle steps, and the second
     counted the 50 standalone chunks as due — so on day one it advertised
     work while the plan correctly said there was none. One place answers
     "what now", and it is the plan. Direct access stays in Araçlar. */
  h+='<h2 class="sec">Araçlar</h2>'+
   navRow("Üretim","Speak the sentence before the model plays — "+(UNITS.reduce(function(n,u){return n+u.read.lines.length;},0)+CHUNKS.length)+" prompts","go('prod')")+
   navRow("Tekrar motoru","The words the course teaches once — drilled until they stick","go('tekrar')")+
   navRow("Dinleme","Write down what you hear, or understand it with no text — at speed","go('dinle')")+
   navRow("Seviye sınavı","Placement test — find your level in 12 questions","startPlacement()")+
   navRow("Sözlük","Every word — course and everyday ("+dictAll().length+") — by type","go('dict')")+
   navRow("Sözlüğüm","Saved words ("+S.star.length+") · review queue and flashcards","go('words')")+
   navRow("Bu kurs hakkında","How the course works, and where the texts come from","go('about')");

  h+='<p class="foot">Progress is stored on this device only.<br>Texts are original, adapted or public domain — see About.</p></div>';
  app().innerHTML=h;
}
/* Plain-English orientation, because the interface is Turkish-labelled and
   a beginner has no way to know that Tekrar is empty by design rather than
   broken. Shown until A2 is complete, then it retires itself; "Gizle" ends
   it early and About can bring it back. Placed above the plan while nothing
   has been met — on day one you want to read before acting — and below it
   afterwards, where it is reference rather than instruction. */
function tipsOn(){return S.tips!==false&&lvPct("A2")<100;}
function hideTips(){S.tips=false;save();render();}
function showTips(){S.tips=true;save();home();}
function startCard(){
  if(!tipsOn())return "";
  const nx=nextUnit();
  let h='<h2 class="sec">Nasıl çalışır · how to use this</h2><div class="card gram">'+
   '<p>Every label is Turkish with the English underneath. You do not need to read the Turkish to use the app.</p>'+
   '<p><b>1 · Follow Bugün.</b> That card lists the day\'s work in order and its button opens the first thing. If you do only that, you are using the app correctly.</p>'+
   '<p><b>2 · A unit has four tabs</b>, left to right: <b>Kelimeler</b> (ten words, tap one to hear it, tap the star to save it), <b>Dilbilgisi</b> (one grammar point), <b>Okuma</b> (a passage — tap any line for the English), <b>Alıştırma</b> (five questions). Four right out of five ticks the unit.</p>'+
   '<p><b>3 · Reviews fill up on their own.</b> Tekrar, Dinle and Söyle draw only on units you have opened, so early on they are empty — that is correct, not broken. There is nothing to bring back until you have met something.</p>'+
   '<p><b>4 · Turkish letters are optional.</b> Type <code>kalkiyorum</code> for <i>kalkıyorum</i>; every answer box ignores ı ş ğ ç ö ü, so a normal keyboard is fine.</p>'+
   '<p><b>5 · Already know some Turkish?</b> The placement test below puts you at a level in twelve questions, and every level has a <b>test ahead</b> exam that skips it outright if you score 8 of 10.</p>'+
   (nx?'<button class="btn" onclick="go(\'unit\',\''+nx.id+'\',\'v\')">'+esc(nx.lv+" · "+nx.tr)+' ile başla</button>':'')+
   '<button class="btn ghost" onclick="startPlacement()">Seviye sınavı · place me</button>'+
   '<button class="btn ghost" onclick="hideTips()">Gizle · hide this</button></div>';
  return h;
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
function toggleStar(i){
  const w=unit(V.u).vocab[i];
  setStar(w[0],w[1],!isStarred(w[0],w[1]));
  save(); render();
}
function secVocab(u){
  const allIn=u.vocab.every(w=>isStarred(w[0],w[1]));
  let h='<p class="src">Tap a word to hear it. Tap the star to send it to your review queue.</p><div class="card" style="padding:.3rem 1rem">';
  u.vocab.forEach((w,i)=>{
    const on=isStarred(w[0],w[1]);
    h+='<div class="vrow">'+spkBtn(w[0],{aria:"Listen"})+
      '<div class="grow"><div class="vtr">'+esc(w[0])+'</div><div class="ven">'+esc(w[1])+'</div></div>'+
      starBtn(on,"toggleStar("+i+")","Save word")+'</div>';
  });
  h+='</div><button class="btn ghost" onclick="starAll(\''+u.id+'\')">'+(allIn?"Tümü listede ✓":"Tüm kelimeleri tekrara ekle")+'</button>'+
   '<button class="btn" onclick="go(\'unit\',\''+u.id+'\',\'g\')">Dilbilgisine geç →</button>';
  return h;
}
function starAll(uid){
  unit(uid).vocab.forEach(w=>setStar(w[0],w[1],true));
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
   '';
  /* Two rows: the study pace, then past normal. Eight buttons in one row
     do not fit a phone, and the split is the point anyway. */
  SPEEDS.forEach(function(row){
    h+='<div class="vrow2 spds">';
    row.forEach(function(x){
      h+='<button class="spd '+(Math.abs(x-r)<0.01?"on":"")+(x>1?" fast":"")+'" data-r="'+x+'" onclick="setRate('+x+')">'+x+'×</button>';
    });
    h+='</div>';
  });
  h+='<p class="tiny" id="vstat" style="margin:.45rem 0 0;min-height:1.1em"></p>'+
   '<p class="tiny" style="margin:.3rem 0 0">Gölge: each line plays, then waits the same length for you to repeat it aloud. Speeds above 1× are the listening training — see Dinleme.</p></div>';
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

/* ===================== review screen ===================== */
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
    spkBtn(p[0],{style:"margin-top:.7rem",text:" dinle"})+
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
      h+='<div class="vrow">'+spkBtn(p[0],{aria:"Listen"})+
        '<div class="grow"><div class="vtr">'+esc(p[0])+'</div><div class="ven">'+esc(p[1])+'</div></div>'+
        starBtn(true,"unstar("+(S.star.length-1-i)+")","Remove")+'</div>';
    });
    h+='</div>';
  }
  h+='</div>';
  app().innerHTML=h;
}
function unstar(i){dropStar(S.star[i]);save();render();}
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
    spkBtn(p[0],{style:"margin-top:.6rem",stop:true,text:" dinle"})+
    (FC.show?'<p class="sub" style="margin-top:1rem;font-size:1.05rem">'+esc(p[1])+'</p>':'<p class="tiny" style="margin-top:1rem">tap to reveal</p>')+'</div>';
  h+='<div class="btn-row"><button class="btn ghost" onclick="flip()">Çevir</button><button class="btn" onclick="nextCard()">Sonraki</button></div></div>';
  app().innerHTML=h;
}

/* ===================== sözlük · the whole word list ===================== */
/* Every word the course teaches, in one place, filterable. Verbs and
   multiword entries classify themselves; POS carries the rest. */
const CATS=[["all","Tümü","all"],["n","İsim","nouns"],["f","Fiil","verbs"],
            ["s","Sıfat","adjectives"],["z","Zarf","adverbs"],
            ["e","Edat","particles"],["i","İfade","expressions"]];
const SRCS=[["all","Tümü","everything"],["course","Ders","the sixty units"],["core","Çekirdek","everyday extras"]];
let DICT={q:"",cat:"all",src:"all",topic:"",sort:"az"};

function wordClass(t){
  const s=String(t).trim();
  if(/(mak|mek)$/.test(s))return "f";     /* verb first: "geç kalmak" is a verb */
  if(POS[s])return POS[s];
  return /\s/.test(s)?"i":"n";           /* a phrase unless told otherwise */
}
/* Two sources, one list: the sixty units, and the everyday words the
   course never had room for. A course row opens its unit; a core row
   filters to its topic, since it has no unit to go to. */
function dictAll(){
  const seen={}, out=[];
  UNITS.forEach(u=>u.vocab.forEach(w=>{
    if(seen[w[0]])return; seen[w[0]]=1;
    out.push({tr:w[0],en:w[1],lv:u.lv,u:u.id,n:u.n,c:wordClass(w[0]),src:"course"});
  }));
  CORE.forEach(e=>{
    if(seen[e.t])return; seen[e.t]=1;
    out.push({tr:e.t,en:e.en,lv:e.k,k:e.k,c:/(mak|mek)$/.test(e.t.trim())?"f":(e.c||"n"),src:"core"});
  });
  return out;
}
function dictRows(){
  const q=fold(DICT.q);
  let r=dictAll();
  if(DICT.src!=="all")r=r.filter(w=>w.src===DICT.src);
  if(DICT.topic)r=r.filter(w=>w.k===DICT.topic);
  if(DICT.cat!=="all")r=r.filter(w=>w.c===DICT.cat);
  if(q)r=r.filter(w=>fold(w.tr).indexOf(q)>-1||fold(w.en).indexOf(q)>-1);
  if(DICT.sort==="az")r.sort((x,y)=>x.tr.localeCompare(y.tr,"tr"));
  else r.sort((x,y)=>{
    /* by level for course words, then the core list by topic */
    const a=LEVELS.findIndex(l=>l.id===x.lv), b=LEVELS.findIndex(l=>l.id===y.lv);
    if(a<0&&b<0)return x.lv===y.lv?x.tr.localeCompare(y.tr,"tr"):x.lv.localeCompare(y.lv,"tr");
    if(a<0)return 1;
    if(b<0)return -1;
    return a===b?x.n-y.n:a-b;
  });
  return r;
}
function dictSearch(v){DICT.q=v;render();}
function dictCat(c){DICT.cat=c;render();}
function dictSrc(s){DICT.src=s;if(s==="course")DICT.topic="";render();}
function dictTopic(k){DICT.topic=k;DICT.src=k?"core":DICT.src;render();}
function dictSort(){DICT.sort=DICT.sort==="az"?"lv":"az";render();}
/* Starring from the word list works by key, not by index into a unit. */
function starWord(tr,en){setStar(tr,en,!isStarred(tr,en));save();render();}
function renderDict(){
  const rows=dictRows(), all=dictAll();
  const inSrc=all.filter(w=>(DICT.src==="all"||w.src===DICT.src)&&(!DICT.topic||w.k===DICT.topic));
  const count=c=>c==="all"?inSrc.length:inSrc.filter(w=>w.c===c).length;
  let h=bar("Sözlük","ders ve çekirdek · every word",true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem .8rem">'+all.length+' words: the '+all.filter(w=>w.src==="course").length+
   ' the sixty units teach and '+all.filter(w=>w.src==="core").length+' everyday ones they never had room for. Tap a word to hear it, the star to save it, or the row for its unit or topic.</p>';
  h+='<input class="inp" id="dq" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" '+
    'placeholder="ara · search Turkish or English" oninput="dictSearch(this.value)" value="'+esc(DICT.q)+'">';
  h+='<div class="segs" style="margin:.7rem 0 .4rem">';
  SRCS.forEach(function(s){
    h+='<button class="'+(DICT.src===s[0]?"on":"")+'" onclick="dictSrc(\''+s[0]+'\')">'+s[1]+'<i>'+s[2]+'</i></button>';
  });
  h+='</div>';
  h+='<div class="pillrow" style="margin:.2rem 0">';
  CATS.forEach(function(c){
    h+='<button class="pill '+(DICT.cat===c[0]?"cob":"")+'" style="border:0" onclick="dictCat(\''+c[0]+'\')">'+
     c[1]+' '+count(c[0])+'</button>';
  });
  h+='</div>';
  if(DICT.topic)h+='<div class="pillrow" style="margin:.2rem 0"><button class="pill gold" style="border:0" onclick="dictTopic(\'\')">konu: '+esc(DICT.topic)+' ×</button></div>';
  h+='<div class="row" style="margin:.5rem .2rem"><span class="tiny grow">'+rows.length+' kelime'+
   (DICT.cat==="all"?"":" · "+CATS.find(c=>c[0]===DICT.cat)[2])+'</span>'+
   '<button class="sbtn" onclick="dictSort()">'+(DICT.sort==="az"?"A→Z":"seviyeye göre")+'</button></div>';
  if(!rows.length)h+='<div class="empty">Bu aramaya uygun kelime yok.<br>No word matches that search.</div>';
  else{
    h+='<div class="card" style="padding:.3rem 1rem">';
    rows.forEach(function(w){
      const on=isStarred(w.tr,w.en);
      h+='<div class="vrow">'+
        spkBtn(w.tr,{aria:"Listen"})+
        '<button class="grow" style="background:none;border:0;text-align:left;padding:0" onclick="'+
        (w.src==="course"?'go(\'unit\',\''+w.u+'\',\'v\')':'dictTopic(\''+w.k+'\')')+'">'+
        '<span class="vtr">'+esc(w.tr)+'</span><span class="ven" style="display:block">'+esc(w.en)+'</span></button>'+
        '<span class="pill '+(w.src==="core"?"turk":"")+'" style="flex:0 0 auto">'+esc(w.lv)+'</span>'+
        starBtn(on,"starWord('"+jsq(w.tr)+"','"+jsq(w.en)+"')","Save word")+
        '</div>';
    });
    h+='</div>';
  }
  h+='<p class="foot">Classified by ending where Turkish allows it — anything in -mak or -mek is a verb — and by hand otherwise. A word can belong to more than one class; the list picks the one it is used in here.</p></div>';
  app().innerHTML=h;
  /* Typing re-renders the screen, so put the cursor back where it was. */
  const box=document.getElementById("dq");
  if(box&&DICT.q){try{box.focus();box.setSelectionRange(DICT.q.length,DICT.q.length);}catch(e){}}
}

/* ===================== about ===================== */
function renderAbout(){
  let h=bar("Bu kurs hakkında","About",true)+'<div class="wrap"><div class="card gram">'+
  '<p class="lead">Nasıl çalışır</p>'+
  '<p>Six CEFR levels, ten units each — sixty in all. Every unit has four parts: <b>Kelimeler</b> (ten words you can save), <b>Dilbilgisi</b> (one grammar point with a table and examples), <b>Okuma</b> (a graded passage, tap any line for the English), and <b>Alıştırma</b> (five questions).</p>'+
  '<p class="lead" style="margin-top:1.3rem">Ses · listening and shadowing</p>'+'<p>Every reading passage has a <b>Dinle</b> button (it reads the whole text aloud, line by line, at the speed you choose) and a <b>Gölge</b> button for shadowing: each line plays, then the app waits exactly as long again for you to repeat it out loud. Tap any single line’s speaker to hear just that line, and any vocabulary word to hear it alone.</p>'+'<p>This uses your device’s own Turkish voice. If nothing is heard, your phone has no Turkish voice installed — on Android add it under Settings → Languages → Text-to-speech; on iOS it is usually already there.</p>'+'<p class="lead" style="margin-top:1.3rem">Tekrar · the review queue</p>'+'<p>Starred words enter a spaced queue. Grade a word <b>Zor</b> and it returns today; <b>İyi</b> and it returns later each time — 1, 2, 4, 8, 16 days and on. The home screen shows what is due.</p>'+'<p class="lead" style="margin-top:1.3rem">Dinleme · listening without the text</p>'+'<p>Dinle and Gölge leave the passage on screen, which trains reading with a soundtrack. <b>Dinleme</b> takes the text away. In <b>Dikte</b> a line plays and you type what you heard; the app marks it word by word and names the words that never reached you — diacritics are ignored, missing words are not. In <b>Ses önce</b> nothing is typed: you listen, decide whether it landed, and only then see the Turkish and the English.</p>'+'<p>The speed goes past normal on purpose, up to 1.75× on a passage and 1.5× in Dinleme. Real speech does not slow down, and comprehension that only works at 0.85× is comprehension that fails in a conversation. You can also cut the replays to one, which is how often a sentence is actually said to you.</p>'+'<p>One honest limit: this is your device’s own Turkish voice, not a recording of a person. It has no reduction, no regional accent and no overlapping speakers, so a clean 1.5× here is a floor and not a finish — the units on <i>Karagöz</i> and on <i>ağızlar</i> describe what it leaves out. Turkish radio and podcasts are the next step, and they are free.</p>'+'<p class="lead" style="margin-top:1.3rem">Üretim · saying it first</p>'+'<p>Reading and listening are not speaking. <b>Üretim</b> gives you the English, then a silence of a few seconds, and only then plays the Turkish — so the sentence has to leave your mouth before you hear the model. You mark yourself <b>Doğru</b> or <b>Yanlış</b>, and the sentences ride the same widening schedule as the words.</p>'+'<p>Long sentences can be built <b>backwards</b>, from the end forwards: <i>bilmiyorum → ne dediğini bilmiyorum → adamın ne dediğini bilmiyorum</i>. The verb lands last in Turkish, and holding the shape until it arrives is the thing that breaks fluency. A sentence you mark wrong is offered this way automatically.</p>'+'<p>Alongside the course’s own sentences there is a bank of fifty <b>kalıplar</b> — the conversational prefabs you reach for whole — and <b>üç kez anlat</b>, which brings a unit’s speaking task back on day one, day three and day seven. Nothing is recorded and no microphone is used: you are the judge, which is also what keeps it working offline.</p>'+'<p>A unit is ticked when you answer 80% of its questions correctly. Each level also has a <b>test ahead</b> exam: ten questions drawn from the whole level, and eight correct marks the level complete — so nothing you already know has to be sat through.</p>'+
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
  (S.tips===false?'<div class="card"><p class="lead">Başlangıç rehberi</p>'+
   '<p class="sub">The how-to-use card on the home screen is hidden. It retires itself once A2 is complete.</p>'+
   '<button class="btn ghost" onclick="showTips()">Tekrar göster</button></div>':'')+
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
                   prod:{},retell:{},gap:S.gap,prompten:S.prompten,pscope:S.pscope,
                   dinle:{},drate:S.drate,dreplay:S.dreplay,rep:{},tips:S.tips},o);
  if(!S.done)S.done={}; if(!S.star)S.star=[]; if(!S.srs)S.srs={}; if(!S.seen)S.seen={};
  if(!S.tested)S.tested={}; if(!S.days)S.days=[];
  if(!S.prod)S.prod={}; if(!S.retell)S.retell={}; if(!S.dinle)S.dinle={}; if(!S.rep)S.rep={};
  save();
  if(S.rate)VOICE.rate=S.rate;
  home();
}
function wipe(){
  if(typeof confirm==="function"&&!confirm("Delete all progress, saved words and your place? This cannot be undone."))return;
  S={done:{},seen:{},place:null,star:[],tested:{},days:[],theme:S.theme,srs:{},rate:S.rate,
     prod:{},retell:{},gap:S.gap,prompten:S.prompten,pscope:S.pscope,
     dinle:{},drate:S.drate,dreplay:S.dreplay,rep:{},tips:S.tips};
  save(); home();
}

