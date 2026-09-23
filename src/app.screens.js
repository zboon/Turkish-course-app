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
  const here=currentLevel();
  let road='<div class="road"><div class="road-line"></div><div class="road-fill" style="width:'+(88*allPct()/100).toFixed(1)+'%"></div><div class="road-stops">';
  LEVELS.forEach(l=>{
    const cls=lvPct(l.id)===100?"done":(l.id===here?"here":"");
    road+='<button class="stop '+cls+'" onclick="go(\'level\',\''+l.id+'\')"><i></i><b>'+l.id+'</b></button>';
  });
  road+='</div></div>';

  let h='<div class="bar"><div class="bar-in">'+enBtn()+'<div class="bar-title">Türkçe<small>A1 → C2</small></div>'+
   '<button class="icon-btn" onclick="toggleTheme()" aria-label="Theme">'+themeIcon()+'</button></div>'+saveWarn()+'</div>';
  h+='<div class="wrap"><div class="hero">'+crest(76)+
   '<h1 class="mark">Türkçe</h1>'+
   clockHero()+'</div>';

  /* Read-then-act on day one; the plan is the whole opinion afterwards. */
  if(metUnits().length===0){ h+=startCard(); h+=planCard(); }
  else { h+=planCard(); }
  h+=road;
  h+=homeBlocks();
  if(metUnits().length>0) h+=startCard();

  h+='<p class="foot">Progress is stored on this device only.<br>Texts are original, adapted or public domain — see About.</p></div>';
  paint(h);
}
/* Two doors, and that is the whole menu.
   This page used to carry six level cards and fifteen tool rows in one
   column under a heading apiece. Every one of them was reachable, which
   is not the same as findable: a list that long reads as texture rather
   than as choices, and the plan — the one thing that answers "what now"
   — sat above a wall the eye slides off.

   The line under each door is deliberately NOT a count of work waiting.
   Two "N waiting" cards lived on this screen once and were removed for
   good reason: they duplicated the plan's own steps, and one advertised
   work on day one that the plan correctly said did not exist. The plan
   owns "what now". A door only says what is behind it. */
function homeBlocks(){
  const done=UNITS.filter(u=>isDone(u.id)).length;
  const lv=currentLevel();
  return '<h2 class="sec">Nereye · where to</h2>'+
   '<button class="block" onclick="go(\'dersler\')">'+
     '<span class="block-t">Dersler</span>'+
     '<span class="block-e">LESSONS</span>'+
     '<span class="block-n">'+done+' / '+UNITS.length+' ünite'+(lv?' · şu an '+lv:'')+'</span>'+
     '<span class="chev">'+IC.chev+'</span></button>'+
   '<button class="block" onclick="go(\'araclar\')">'+
     '<span class="block-t">Araçlar</span>'+
     '<span class="block-e">PRACTICE AND TOOLS</span>'+
     '<span class="block-n">Konuşma · Dinleme · Tekrar · Kelimeler</span>'+
     '<span class="chev">'+IC.chev+'</span></button>';
}

/* ===================== dersler · the course spine ===================== */
function renderDersler(){
  let h=bar("Dersler","lessons · A1 → C2",true)+'<div class="wrap">';
  h+='<div class="stat"><div><b>'+UNITS.filter(u=>isDone(u.id)).length+'</b><span>units done</span></div>'+
     '<div><b>'+streak()+'</b><span>day streak</span></div>'+
     '<div><b>'+S.star.length+'</b><span>saved words</span></div></div>';
  /* Başlarken sits above the levels while nothing has been opened — on
     day one it is where to start — and below them afterwards, where it
     is reference. The same rule the orientation card follows. */
  const start='<h2 class="sec">Başlarken</h2>'+
   navRow("Giriş dersleri","Before unit one — letters, sounds, word building and sentence order · "+baslaCount()+" / "+BASLA.length,"go('baslarken')")+
   navRow("Seviye sınavı","Placement test — find your level in 12 questions","startPlacement()")+
   navRow("Nasıl çalışır","How the app works, in plain English","go('nasil')");
  const first=metUnits().length===0;
  if(first)h+=start;
  h+='<h2 class="sec">Seviyeler</h2>';
  LEVELS.forEach(l=>{
    const p=lvPct(l.id), t=S.tested[l.id];
    h+='<button class="card" onclick="go(\'level\',\''+l.id+'\')"><div class="row">'+
      '<span class="lvl-badge '+(p===100?"on":(t?"tested":""))+'">'+l.id+'</span>'+
      '<div class="grow"><p class="lead">'+esc(l.tr)+'</p><p class="sub">'+esc(l.en)+' · '+lvDone(l.id)+'/'+unitsOf(l.id).length+' ünite</p></div>'+
      '<span class="chev">'+IC.chev+'</span></div><div class="meter"><i style="width:'+p+'%"></i></div></button>';
  });
  if(!first)h+=start;
  h+='<p class="foot">A unit is ticked at four right out of five.<br>Each level also has a test-ahead exam that skips it outright.</p></div>';
  paint(h);
}

/* ===================== araçlar · everything else ===================== */
/* Grouped by what the mode asks of you rather than by when it was built,
   because that is how one is reached for: you know whether you want to
   talk, to listen, to bring something back or to look something up. */
function renderAraclar(){
  let h=bar("Araçlar","tools · beside the lessons",true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">Everything here is optional. If you only follow <b>Bugün</b> on the home screen you are using the course correctly — these are for working on one thing in particular.</p>';
  /* Six of these thirteen draw on nothing but themselves — a bank of
     prefabs, a generator, the whole word list — and are exactly as full
     on day one as they ever are. The other five start at zero and fill in
     as units are read, words starred, mistakes made: a curious beginner
     who wanders in early can open any of them and land on an honest "not
     yet" card, the same anticlimax renderGram()/renderHata() already
     handle gracefully one tap in, but one tap too late to save the visit.
     hazır says which is which before that tap, computed live off the same
     banks the hubs themselves check — never a fixed list, so it keeps
     telling the truth as the five fill in. */
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">A <span class="pill turk">hazır</span> tag means there is something to do here right now, with nothing read yet. The rest fill in on their own as you work through the course.</p>';

  h+='<h2 class="sec">Konuşma · speaking</h2>'+
   navRow("Üretim","Speak the sentence before the model plays — "+(UNITS.reduce(function(n,u){return n+u.read.lines.length;},0)+CHUNKS.length)+" prompts","go('prod')",true)+
   navRow("Yolda","Hands-free — spoken prompts, nothing to tap, 5 or 10 minutes","go('yolda')",true)+
   navRow("Sor","Ask the question, not just answer it — wh- and yes/no","go('sor')",true)+
   navRow("Diyalog","A conversation that answers back — and the repair kit","go('diyalog')",true)+
   navRow("Atasözleri ve deyimler","Said whole, not assembled — "+(ATASOZU.length+DEYIM.length)+" sayings","go('ata')",true);

  h+='<h2 class="sec">Dinleme · listening</h2>'+
   navRow("Dinleme","Write down what you hear, or understand it with no text — at speed","go('dinle')",listenBank("d:").length>0||listenBank("a:").length>0)+
   navRow("Sayılar","Numbers, times and prices — against a clock","go('sayilar')",true);

  h+='<h2 class="sec">Tekrar · bringing it back</h2>'+
   navRow("Tekrar motoru","The words the course teaches once — drilled until they stick","go('tekrar')",repBank().length>0)+
   navRow("Dilbilgisi tekrarı","The "+UNITS.length+" grammar points, brought back and produced from English","go('gram')",gramBank().length>0)+
   navRow("Sözlüğüm","Saved words ("+S.star.length+") · review queue and flashcards","go('words')",S.star.length>0)+
   navRow("Hata defteri","What you got wrong, why, and what keeps catching you"+(errRepeat().length?" — "+errRepeat().length+" repeating":""),"go('hata')",Object.keys(S.err).length>0);

  h+='<h2 class="sec">Kelimeler · words</h2>'+
   navRow("Sık kelimeler","The commonest words the units never teach — ten a day, into your reviews","go('sik')",sikBatch().length>0)+
   navRow("Sözlük","Every word — course and everyday ("+dictAll().length+") — by type","go('dict')",true)+
   navRow("Kendi kelimelerim","Add a word you met in the wild — it joins the same queue"+((S.mine&&S.mine.length)?" ("+S.mine.length+")":""),"mineOpen()",true);

  h+='<h2 class="sec">Kurs</h2>'+
   navRow("Nasıl çalışır","How the app works, in plain English","go('nasil')")+
   navRow("Bu kurs hakkında","How the course works, and where the texts come from","go('about')");

  h+='<p class="foot">Nothing here has to be done in any order.<br>Reviews draw only on material you have actually met.</p></div>';
  paint(h);
}

/* Plain-English orientation, because the interface is Turkish-labelled and
   a beginner has no way to know that Tekrar is empty by design rather than
   broken. Shown until A2 is complete, then it retires itself; "Gizle" ends
   it early and About can bring it back. Placed above the plan while nothing
   has been met — on day one you want to read before acting — and below the
   doors afterwards, where it is reference rather than instruction. */
function tipsOn(){return S.tips!==false&&lvPct("A2")<100;}
function hideTips(){S.tips=false;save();render();}
function showTips(){S.tips=true;save();home();}
/* Five paragraphs of it used to sit inline on the landing page, then two
   sentences, and now a line that unfolds. It is the right text and a
   beginner needs it — nothing else explains that an empty Tekrar is
   correct rather than broken — but it is reading rather than a control.

   OPEN WHILE IT IS INSTRUCTION, FOLDED ONCE IT IS REFERENCE. That is the
   same rule that already decides where it sits: above the plan while
   nothing has been met, below it afterwards. On day one it is the only
   thing telling a learner what any of this is, so it is open; once
   something has been met the learner has been told, and it folds.
   TIPSOPEN starts null meaning "whichever that rule says", and only
   pins a value once the learner has actually tapped it. */
let TIPSOPEN=null;
function tipsToggle(){TIPSOPEN=!tipsShown();render();}
function tipsShown(){return TIPSOPEN===null?metUnits().length===0:TIPSOPEN;}
function startCard(){
  if(!tipsOn())return "";
  const open=tipsShown();
  let h='<div class="card gram">'+
   '<button class="disc" onclick="tipsToggle()" aria-expanded="'+(open?"true":"false")+'">'+
    '<span class="grow"><b>Nasıl çalışır</b><span class="gl">how to use this</span></span>'+
    '<span class="ic">'+(open?IC.caret:IC.chev)+'</span></button>';
  if(open){
    h+='<p class="sub" style="margin:0 0 .2rem">Every label is Turkish with the English underneath, and you do not need to read the Turkish to use the app. Follow <b>Bugün</b> and you are using the course correctly — everything in Araçlar is optional.</p>'+
     /* No "start the first unit" button here: the plan directly below
        already has one, pointed at the same unit, and two identical
        primary actions on one screen is the wall in miniature. */
     '<button class="btn ghost" onclick="go(\'nasil\')">Devamını oku · the rest</button>'+
     '<button class="btn ghost" onclick="hideTips()">Gizle · hide this</button>';
  }
  return h+'</div>';
}
function renderNasil(){
  const nx=nextUnit();
  let h=bar("Nasıl çalışır","how to use this",true)+'<div class="wrap"><div class="card gram">'+
   '<p>Every label is Turkish with the English underneath. You do not need to read the Turkish to use the app. The English stays until A2 is complete, then steps aside so the Turkish does the work; the <b>EN</b> button at the top of every screen turns it off or back on whenever you like.</p>'+
   '<p><b>1 · Follow Bugün.</b> That card lists the day\'s work in order and its button opens the first thing. If you do only that, you are using the app correctly.</p>'+
   '<p><b>2 · A unit has four tabs</b>, left to right: <b>Kelimeler</b> (ten words, tap one to hear it, tap the star to save it), <b>Dilbilgisi</b> (one grammar point), <b>Okuma</b> (a passage — tap any line for the English), <b>Alıştırma</b> (five questions). Four right out of five ticks the unit.</p>'+
   '<p><b>3 · Reviews fill up on their own.</b> Tekrar, Dinle and Söyle draw only on units you have opened, so early on they are empty — that is correct, not broken. There is nothing to bring back until you have met something.</p>'+
   '<p><b>4 · Turkish letters are optional.</b> Type <code>kalkiyorum</code> for <i>kalkıyorum</i>; every answer box ignores ı ş ğ ç ö ü, so a normal keyboard is fine.</p>'+
   '<p><b>5 · Where to start.</b> From nothing, <b>Bugün</b> begins with six short lessons before unit one: the letters and their sounds, how words are spelt, stressed and built, and how a sentence is put together. They are in Dersler under <b>Başlarken</b>, and none of them is required.</p>'+
   '<p><b>Already know some Turkish?</b> Skip the lessons and go straight to unit one, or take the placement test: it puts you at a level in twelve questions, and every level has a <b>test ahead</b> exam that skips it outright if you score 8 of 10.</p>'+
   '<p><b>6 · Two doors.</b> <b>Dersler</b> is the course itself — sixty units across six levels. <b>Araçlar</b> is everything beside it: speaking, listening, review and the word lists. None of Araçlar is required.</p>'+
   (nx?'<button class="btn" onclick="go(\'unit\',\''+nx.id+'\',\'v\')">'+esc(nx.lv+" · "+nx.tr)+' ile başla</button>':'')+
   '<button class="btn ghost" onclick="startPlacement()">Seviye sınavı · place me</button>'+
   (tipsOn()?'<button class="btn ghost" onclick="hideTips()">Ana ekranda gizle · hide on the home screen</button>':'')+
   '</div></div>';
  paint(h);
}

/* ready is omitted everywhere except Araçlar's practice rows: true paints
   the "hazır" tag, false paints nothing, and leaving it out entirely (as
   Dersler's two calls do) is a different thing from false — it means
   readiness is not this row's business, so no pill either way. */
function navRow(t,s,fn,ready){
  const tag=ready?' <span class="pill turk" style="vertical-align:.1em">hazır</span>':'';
  return '<button class="card nav row" onclick="'+fn+'"><div class="grow"><p class="lead nav-t">'+esc(t)+tag+'</p><p class="sub">'+esc(s)+'</p></div><span class="chev">'+IC.chev+'</span></button>';
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
  paint(h);
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
    h+='<button class="'+(on?"on":"")+'" onclick="go(\'unit\',\''+u.id+'\',\''+s[0]+'\')">'+s[1]+'<i>'+(seen?"✓ ":"")+'<span class="gl">'+s[2]+'</span></i></button>';
  });
  h+='</div>';
  if(sec==="v"||sec==="r")h+=voiceNote();
  if(sec==="v")h+=secVocab(u);
  if(sec==="g")h+=secGram(u);
  if(sec==="r")h+=secRead(u);
  if(sec==="d")h+=secDrill(u);
  h+='</div>';
  paint(h);
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
  h+='</div></div>'+spokenCard(u)+'<button class="btn" onclick="go(\'unit\',\''+u.id+'\',\'r\')">Okumaya geç →</button>';
  return h;
}
/* How the unit's Turkish is actually said, where that differs from how it
   is written. Beside the grammar rather than inside it: the written form
   is still the one the unit teaches, and this is for the ear. */
const REGISTER={herkes:"herkese · with anyone",samimi:"samimi · between friends"};
function spokenCard(u){
  const ns=SPOKEN[u.id]; if(!ns||!ns.length)return "";
  let h='<div class="card spoken"><p class="lead">Konuşurken · how it is said</p>'+
   '<p class="tiny" style="margin:.1rem 0 .4rem">What you will hear, and read in messages, alongside what the unit writes. For recognising first; say it once it sounds natural to you.</p>';
  ns.forEach(function(x){
    h+='<div class="sp"><p class="sp-pair">'+esc(x.w)+' <span class="sp-arrow">→</span> <b>'+esc(x.s)+'</b> '+
     spkBtn(x.s,{aria:"Listen"})+'</p>'+
     '<p class="sub">'+esc(x.n)+'</p><span class="pill '+(x.r==="samimi"?"gold":"turk")+'">'+esc(REGISTER[x.r]||x.r)+'</span></div>';
  });
  return h+'</div>';
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
  /* Copies, tagged with where each drill came from: the mistake book
     keys by item and the raw drill objects are shared data. */
  Q={mode:"unit",u:uid,lv:u.lv,items:u.drill.map(function(d,i){return Object.assign({},d,{uid:uid,di:i});}),
     i:0,res:[],sel:null,built:[],title:u.tr,pass:Math.ceil(u.drill.length*0.8)};
  V={view:"quiz"}; window.scrollTo(0,0); render();
}
function startLevelExam(lv){
  let pool=[]; unitsOf(lv).forEach(u=>{u.drill.forEach((d,i)=>pool.push(Object.assign({},d,{uid:u.id,di:i})));});
  pool=shuffle(pool).slice(0,10);
  Q={mode:"level",lv:lv,items:pool,i:0,res:[],sel:null,built:[],title:lv+" seviye sınavı",pass:8};
  V={view:"quiz"}; window.scrollTo(0,0); render();
}
function startPlacement(){
  Q={mode:"placement",items:PLACEMENT.map((p,i)=>({t:"mc",q:p.q,a:p.a,c:p.c,lv:p.lv,pi:i})),i:0,res:[],sel:null,built:[],title:"Seviye sınavı",pass:0};
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
  /* An intro question can be heard rather than read: it plays once on
     arrival and again on demand, and the word is never printed. */
  if(it.say)h+='<button class="btn ghost" style="margin:0 0 .8rem" onclick="sayWord(\''+jsq(it.say)+'\')">Bir daha dinle</button>';
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
  paint(h);
  if(it.say&&Q.sel===null&&Q.heard&&!Q.heard[Q.i]){Q.heard[Q.i]=1;sayWord(it.say);}
  const fin=document.getElementById("fin"); if(fin&&Q.sel===null)fin.focus();
  if(fin)fin.addEventListener("keydown",e=>{if(e.key==="Enter")answerFill();});
}
function answerMC(i){const it=Q.items[Q.i];Q.sel=i;Q.res[Q.i]=(i===it.c);
  if(!Q.res[Q.i])quizNote(it,it.a[i]);
  render();}
function answerFill(){
  const fin=document.getElementById("fin"); if(!fin)return;
  const v=fin.value; Q.typed=v; Q.sel=0;
  const it=Q.items[Q.i];
  Q.res[Q.i]=fold(v)===fold(it.c)||fold(v).replace(/ /g,"")===fold(it.c).replace(/ /g,"");
  if(!Q.res[Q.i])quizNote(it,v);
  render();
}
function build(i){if(Q.used[i])return;Q.used[i]=1;Q.built.push(Q.pool[i]);Q.bidx=Q.bidx||[];Q.bidx.push(i);render();}
function unbuild(i){const src=Q.bidx[i];Q.used[src]=0;Q.built.splice(i,1);Q.bidx.splice(i,1);render();}
function answerOrder(){
  const it=Q.items[Q.i]; Q.sel=0;
  Q.res[Q.i]=fold(Q.built.join(" "))===fold(it.c);
  if(!Q.res[Q.i])quizNote(it,Q.built.join(" "));
  render();
}
function nextQ(){Q.i++;Q.sel=null;Q.built=[];Q.bidx=[];Q.pool=null;Q.used=[];Q.typed="";window.scrollTo(0,0);render();}
function renderScore(){
  const n=Q.res.filter(Boolean).length, of=Q.items.length;
  touchDay();
  let h=bar(Q.title,"Sonuç",true)+'<div class="wrap">';
  if(Q.mode==="intro"){
    h+=baslaScore(n,of);
  }else if(Q.mode==="placement"){
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
  paint(h);
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
    paint(bar("Tekrar","Bitti",true)+'<div class="wrap"><div class="score"><div class="big pass">'+RV.done+'</div>'+
      '<p class="sub">kelime tekrar edildi · words reviewed</p></div>'+
      '<p class="sub" style="text-align:center">'+dueList().length+' kelime bugün hâlâ bekliyor.</p>'+
      '<button class="btn" onclick="startReview()">Devam</button><button class="btn ghost" onclick="home()">Ana sayfa</button></div>');
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
  paint(h);
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
      '<button class="btn ghost" onclick="mineOpen()">Kendi kelimelerim</button>'+
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
  paint(h);
}
function unstar(i){dropStar(S.star[i]);save();render();}
function startCards(){FC={q:shuffle(S.star),i:0,show:false};V={view:"cards"};window.scrollTo(0,0);render();}
function flip(){FC.show=!FC.show;render();}
function nextCard(){FC.i++;FC.show=false;window.scrollTo(0,0);render();}
function renderCards(){
  if(FC.i>=FC.q.length){
    paint(bar("Kartlar","Bitti",true)+'<div class="wrap"><div class="score"><div class="big pass">'+FC.q.length+'</div><p class="sub">kelime gözden geçirildi</p></div>'+
      '<button class="btn" onclick="startCards()">Tekrar</button><button class="btn ghost" onclick="go(\'words\')">Sözlüğüm</button></div>');
    return;
  }
  const p=FC.q[FC.i].split("|");
  let h=bar("Kartlar",(FC.i+1)+" / "+FC.q.length,true)+'<div class="wrap">';
  h+='<div class="card" style="text-align:center;padding:2.6rem 1rem;min-height:190px" onclick="flip()">'+
    '<p class="mark" style="font-size:2rem;margin:0">'+esc(p[0])+'</p>'+
    spkBtn(p[0],{style:"margin-top:.6rem",stop:true,text:" dinle"})+
    (FC.show?'<p class="sub" style="margin-top:1rem;font-size:1.05rem">'+esc(p[1])+'</p>':'<p class="tiny" style="margin-top:1rem">tap to reveal</p>')+'</div>';
  h+='<div class="btn-row"><button class="btn ghost" onclick="flip()">Çevir</button><button class="btn" onclick="nextCard()">Sonraki</button></div></div>';
  paint(h);
}

/* ===================== sözlük · the whole word list ===================== */
/* Every word the course teaches, in one place, filterable. Verbs and
   multiword entries classify themselves; POS carries the rest. */
const CATS=[["all","Tümü","all"],["n","İsim","nouns"],["f","Fiil","verbs"],
            ["s","Sıfat","adjectives"],["z","Zarf","adverbs"],
            ["e","Edat","particles"],["i","İfade","expressions"]];
const SRCS=[["all","Tümü","everything"],["course","Ders","the sixty units"],["core","Çekirdek","everyday · common"],["mine","Benim","your own"]];
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
  /* The frequency layer lives beside CORE as one more topic, "sık", so the
     source filter stays four segments wide on a phone. */
  SIK.forEach(e=>{
    if(seen[e[0]])return; seen[e[0]]=1;
    out.push({tr:e[0],en:e[1],lv:"sık",k:"sık",c:sikClass(e),src:"core"});
  });
  /* Last, and skipped if the course already teaches it: a learner's own
     gloss is worth less than the unit's, and mineAdd() prevents the
     collision at the door anyway. */
  (S.mine||[]).forEach(e=>{
    if(seen[e.tr])return; seen[e.tr]=1;
    out.push({tr:e.tr,en:e.en,lv:"Benim",c:wordClass(e.tr),src:"mine"});
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
   ' the sixty units teach, '+all.filter(w=>w.src==="core"&&w.k!=="sık").length+' everyday ones by topic, and the '+
   all.filter(w=>w.k==="sık").length+' commonest words of spoken Turkish they never reach (<i>sık</i>). Tap a word to hear it, the star to save it, or the row for its unit or topic.</p>';
  h+='<input class="inp" id="dq" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" '+
    'placeholder="ara · search Turkish or English" oninput="dictSearch(this.value)" value="'+esc(DICT.q)+'">';
  h+='<div class="segs" style="margin:.7rem 0 .4rem">';
  SRCS.forEach(function(s){
    h+='<button class="'+(DICT.src===s[0]?"on":"")+'" onclick="dictSrc(\''+s[0]+'\')">'+s[1]+'<i><span class="gl">'+s[2]+'</span></i></button>';
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
        /* Three sources, three destinations: a course word opens its unit,
           a core word filters to its topic, and one of the learner's own
           has neither — it opens the list it lives in. Without this last
           branch it rendered dictTopic('undefined'). */
        (w.src==="course"?'go(\'unit\',\''+w.u+'\',\'v\')'
         :w.src==="mine"?'mineOpen()'
         :'dictTopic(\''+w.k+'\')')+'">'+
        '<span class="vtr">'+esc(w.tr)+'</span><span class="ven" style="display:block">'+esc(w.en)+'</span></button>'+
        '<span class="pill '+(w.src==="core"?"turk":"")+'" style="flex:0 0 auto">'+esc(w.lv)+'</span>'+
        starBtn(on,"starWord('"+jsq(w.tr)+"','"+jsq(w.en)+"')","Save word")+
        '</div>';
    });
    h+='</div>';
  }
  h+='<p class="foot">Classified by ending where Turkish allows it — anything in -mak or -mek is a verb — and by hand otherwise. A word can belong to more than one class; the list picks the one it is used in here.</p></div>';
  paint(h);
  /* Typing re-renders the screen, so put the cursor back where it was. */
  const box=document.getElementById("dq");
  if(box&&DICT.q){try{box.focus();box.setSelectionRange(DICT.q.length,DICT.q.length);}catch(e){}}
}

/* ===================== about ===================== */
/* Said live, because the device is the one thing the app cannot know in
   advance. The old text claimed a missing Turkish voice meant silence; it
   means the wrong accent, which is worse, and was the reason for this. */
function voiceAbout(){
  const st=voiceState(), v=trVoice();
  const now=st==="ok"?'This device reads Turkish with <b>'+esc(v&&v.name||"a Turkish voice")+'</b>.':
    st==="notr"?'<b>This device has no Turkish voice.</b> It will read Turkish in another language’s voice, with the wrong sounds — so add one before relying on anything you hear.':
    st==="none"?'<b>This browser cannot speak</b>, so nothing is read aloud. Everything else works; a phone’s own browser usually can.':
    'The device has not listed its voices yet. Reopen this page in a moment to see which one is used.';
  return '<p id="ses">Everything is read by your device’s own Turkish voice, not a recording. '+now+'</p>'+
    '<p>To add a Turkish voice, then close and reopen the app. <b>iPhone / iPad:</b> Settings → Accessibility → Spoken Content → Voices → Turkish. '+
    '<b>Android:</b> Settings → Accessibility → Text-to-speech output → the engine’s settings → Install voice data → Turkish. '+
    '<b>Windows:</b> Settings → Time &amp; language → Speech → Add voices → Turkish. '+
    '<b>Mac:</b> System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Turkish. The names move a little between versions.</p>';
}
function renderAbout(){
  let h=bar("Bu kurs hakkında","About",true)+'<div class="wrap"><div class="card gram">'+
  '<p class="lead">Nasıl çalışır</p>'+
  '<p>Six CEFR levels, ten units each — sixty in all. Every unit has four parts: <b>Kelimeler</b> (ten words you can save), <b>Dilbilgisi</b> (one grammar point with a table and examples), <b>Okuma</b> (a graded passage, tap any line for the English), and <b>Alıştırma</b> (five questions).</p>'+
  '<p class="lead" style="margin-top:1.3rem">Ses · listening and shadowing</p>'+'<p>Every reading passage has a <b>Dinle</b> button (it reads the whole text aloud, line by line, at the speed you choose) and a <b>Gölge</b> button for shadowing: each line plays, then the app waits exactly as long again for you to repeat it out loud. Tap any single line’s speaker to hear just that line, and any vocabulary word to hear it alone.</p>'+voiceAbout()+'<p class="lead" style="margin-top:1.3rem">Tekrar · the review queue</p>'+'<p>Starred words enter a spaced queue. Grade a word <b>Zor</b> and it returns today; <b>İyi</b> and it returns later each time — 1, 2, 4, 8, 16 days and on. The home screen shows what is due.</p>'+'<p class="lead" style="margin-top:1.3rem">Tekrar motoru · what the course teaches once</p>'+'<p>Across everything this app can show you, the median taught word turns up <b>three</b> times, and a word needs something like eight before it stays. <b>Tekrar motoru</b> counts the encounters and drills whatever the course will not bring back by itself, worst served first. Where the word appears in a passage you have read, that line returns with it blanked, and the answer is the form the sentence uses. Where it appears nowhere, the English comes first and you type the Turkish.</p>'+'<p class="lead" style="margin-top:1.3rem">Dilbilgisi tekrarı · produce the pattern</p>'+'<p>The same gap, one level up: each unit explains one grammar point, in one tab, and then the course moves on. <b>Dilbilgisi tekrarı</b> brings the point back on the same widening schedule and asks you to build a sentence with it from English. What is scheduled is the point, not the sentence — its worked examples rotate, so the passive keeps coming back and a different sentence carries it each time.</p>'+'<p>Every word has to be there, unlike Dikte, which forgives one word in five — except a subject pronoun such as <i>ben</i> or <i>benim</i>, which the ending already carries, so <i>Adım Deniz</i> and <i>Benim adım Deniz</i> are both right: the sentences are four words long at the median and the form is the whole question, so forgiving a word would forgive the point. The <b>order</b> is yours, though — Turkish is freer than the English prompt, and “Ona mektubu yazdırdım” is as right as “Mektubu ona yazdırdım”. Diacritics are ignored, and the marked line names the word whose ending went wrong.</p>'+'<p>Where the English genuinely leaves the choice open — a synonym, a tense English does not distinguish — you can mark your own answer right. A word-level check can mark words; it cannot mark Turkish, and everything in Üretim is self-graded for the same reason.</p>'+'<p>Both engines only ever draw on what you have actually met: the word bank waits until you have opened a unit’s word list, the sentences wait until you have read its passage, and the grammar waits until you have read the point. An empty review screen on a new install is the app being correct, not broken.</p>'+'<p class="lead" style="margin-top:1.3rem">Dinleme · listening without the text</p>'+'<p>Dinle and Gölge leave the passage on screen, which trains reading with a soundtrack. <b>Dinleme</b> takes the text away. In <b>Dikte</b> a line plays and you type what you heard; the app marks it word by word and names the words that never reached you — diacritics are ignored, missing words are not. In <b>Ses önce</b> nothing is typed: you listen, decide whether it landed, and only then see the Turkish and the English.</p>'+'<p>The speed goes past normal on purpose, up to 1.75× on a passage and 1.5× in Dinleme. Real speech does not slow down, and comprehension that only works at 0.85× is comprehension that fails in a conversation. You can also cut the replays to one, which is how often a sentence is actually said to you.</p>'+'<p>One honest limit: this is your device’s own Turkish voice, not a recording of a person. It has no reduction, no regional accent and no overlapping speakers, so a clean 1.5× here is a floor and not a finish — the units on <i>Karagöz</i> and on <i>ağızlar</i> describe what it leaves out. Turkish radio and podcasts are the next step, and they are free.</p>'+'<p class="lead" style="margin-top:1.3rem">Üretim · saying it first</p>'+'<p>Reading and listening are not speaking. <b>Üretim</b> gives you the English, then a silence of a few seconds, and only then plays the Turkish — so the sentence has to leave your mouth before you hear the model. You mark yourself <b>Doğru</b> or <b>Yanlış</b>, and the sentences ride the same widening schedule as the words.</p>'+'<p>Long sentences can be built <b>backwards</b>, from the end forwards: <i>bilmiyorum → ne dediğini bilmiyorum → adamın ne dediğini bilmiyorum</i>. The verb lands last in Turkish, and holding the shape until it arrives is the thing that breaks fluency. A sentence you mark wrong is offered this way automatically.</p>'+'<p>Alongside the course’s own sentences there is a bank of '+CHUNKS.length+' <b>kalıplar</b> — the conversational prefabs you reach for whole, grouped by what each one does: agreeing, refusing, asking again when you have missed something, buying the thing, holding the floor — and <b>üç kez anlat</b>, which brings a unit’s speaking task back on day one, day three and day seven. Nothing is recorded and no microphone is used: you are the judge, which is also what keeps it working offline.</p>'+'<p class="lead" style="margin-top:1.3rem">Sor · asking</p>'+'<p>Everything else in this app answers. Sixty units of reading, hundreds of sentences to produce — and almost none of it is a question, which leaves you able to reply and unable to keep a conversation going. <b>Sor</b> drills the other half.</p>'+'<p>In <b>Ne sordum</b> a statement arrives and you produce the question it answers: <i>Okula gidiyorum</i> is the answer to <i>Nereye gidiyorsun?</i> — and note that the person moves, because nobody asks <i>Nereye gidiyorum?</i> to get that reply. In <b>Evet/hayır</b> you turn a statement into a yes-or-no question, which in Turkish is a matter of where <i>mi</i> lands, which vowel it takes, and what the person ending goes on.</p>'+'<p>The questions are assembled at the moment they are shown, from the same word list the built sentences use, so there is nothing to memorise. What comes back is the question word you were weak at rather than a sentence you happened to miss.</p>'+'<p class="lead" style="margin-top:1.3rem">Diyalog · keeping it alive</p>'+'<p>Everything else in this app is one exchange with a known answer. A conversation is not: what comes back depends on what you said, and sometimes you simply do not catch it. <b>Diyalog</b> is a short errand — a ticket, a stall, a pharmacy — with someone who talks at normal speed and has no idea you are learning. You <b>hear</b> them. You never read them.</p>'+'<p>What ends a conversation is almost never the missing word. It is the pause after it, and then the other person switches to English. So the only thing marked here is whether you <b>finished</b>: a conversation completed with four repairs is a success, and one abandoned over a single word is the failure this mode exists to train away. <b>Asking someone to repeat themselves costs you nothing</b>, and nothing keeps count of it between runs.</b></p>'+'<p>Three repair moves sit on screen in every conversation, and each does something different: <i>bir daha söyler misiniz</i> and <i>daha yavaş lütfen</i> get it said again, slower and slower; <i>affedersiniz, anlamadım</i> gets it rephrased in plainer words. They are not new — you have been drilling them in Üretim as kalıplar. This is the first place they are the difference between finishing and walking out. There is deliberately no free replay button: if hearing it again were one tap away, none of this would ever be needed.</p>'+'<p>The prices, times and places are generated every run, so the answer cannot be remembered — only heard — and the numbers are the one thing a machine can honestly mark, by the same check Sayılar uses. Getting one wrong does not end the conversation. In a shop you would hand over the wrong note and be corrected; you would not walk out.</p>'+'<p class="lead" style="margin-top:1.3rem">Atasözleri ve deyimler · said whole</p>'+'<p>Everything else you produce here has to be assembled — person, tense, case, and the verb last — and assembling is slow while the grammar is still new. A proverb is one stored object, and it comes out at full speed. That makes this the cheapest fluency in the language, which is exactly what a slow speaker needs.</p>'+'<p>In <b>Atasözleri</b> you are given a situation and produce the saying that answers it, never the other way round: knowing the words is not the skill, knowing the <i>moment</i> is, and a proverb said at the wrong one is worse than saying nothing. In <b>Deyimler</b> the English meaning comes first and you type the idiom. What the words literally say is shown <i>after</i> you answer — <i>kafa patlatmak</i> is not “to burst a head”, and that gap is the whole reason an idiom has to be learned in one piece rather than looked up word by word.</p>'+'<p>This is the strictest marking in the app: every word, in order, nothing extra. Dikte forgives one word in five and Dilbilgisi lets you reorder freely, but a fixed saying with one word wrong is not a saying slightly misremembered — it is a sentence nobody says. Diacritics are forgiven as everywhere else.</p>'+'<p>Where a saying genuinely has more than one real wording, both are accepted and you are shown the other after a right answer: <i>işleyen demir pas tutmaz</i> and <i>işleyen demir ışıldar</i> are both said. And if you know a wording this list does not, you can overrule the mark — the variants here are only as good as whoever wrote them down, and a wording you met in the street is not wrong for being missing.</p>'+'<p>These are anonymous folk material. There is no author to credit and no edition to check a line against, which is why this shelf could be built while the library of named authors is still waiting.</p>'+'<p class="lead" style="margin-top:1.3rem">Sayılar · numbers at speed</p>'+'<p>Turkish numbers are perfectly regular — <i>yüz yetmiş beş</i> is a hundred seventy-five and there is nothing to memorise — so knowing them was never the problem. Getting them <b>in time</b> is. Someone says a price and you have a second or two, not ten, and the conversion that arrives afterwards is no use to anybody.</p>'+'<p>So <b>Sayılar</b> puts a clock on it, and the clock is part of the mark: right but slow does not move a shape out a box. You can turn the bar off, but that is a decision you make rather than one the drill makes for you. What is scheduled is the <b>shape</b> — two digits, hundreds, thousands, the clock, a price — because that is what a person is slow at, not any particular number.</p>'+'<p>In <b>Duy</b> a number is said once and you type the digits. This is the second thing in the app the machine marks rather than you, after Dikte, and for the same reason: <i>altmış</i> and <i>yetmiş</i> sound alike at speed, and someone who heard the wrong one is certain they were right. A typed 342 either is or is not the answer. In <b>Söyle</b> the digits are on screen and you read them out before the model plays — that one you mark yourself, but the clock still runs.</p>'+'<p>Two things worth knowing, because they are where it goes wrong: a hundred is <i>yüz</i> and never <i>bir yüz</i>, and a thousand is <i>bin</i> and never <i>bir bin</i> — but a million keeps its bir, <i>bir milyon</i>. And past half past, the clock counts down to the <i>next</i> hour: 3:35 is <i>dörde yirmi beş var</i>, twenty-five to four.</p>'+'<p>The <b>time now</b>, in words, sits under the title on the home screen — <i>üçü çeyrek geçiyor</i>, with 15:15 beneath it. Nothing to start and nothing to mark: you read it a few times a day without meaning to, and the construction that never feels natural becomes ordinary. Tap it to come here.</p>'+'<p>Underneath it, the <b>date</b> the same way — <i>yirmi üç Eylül Çarşamba</i>, with 23.09.2026 beneath. No unit ever teaches the months, so this is the only place they turn up at all: read a dozen times over a year and Ocak through Aralık stop needing to be learned on purpose.</p>'+'<p class="lead" style="margin-top:1.3rem">Kendi kelimelerim · your own words</p>'+'<p>A word off a shop sign, out of a subtitle, or from someone talking to you. <b>Kendi kelimelerim</b> takes the Turkish and what it means, and stars it — so it joins the same spaced queue as any word you saved from a unit, and turns up under <b>Tekrar</b> in Bugün from the next day. There is nothing else to set up.</p>'+'<p>Adding a word the course already teaches stars that one instead of making a second copy, and pasted text is cleaned on the way in: a soft hyphen or a zero-width space out of a web page is invisible on screen and would break every match it touched. They appear in Sözlük under <b>Benim</b>, and editing one carries its place in the queue across rather than starting it again.</p>'+'<p>They do not feed <b>Tekrar motoru</b>, and that is deliberate: it ranks words by how often this app\u2019s own material mentions them, and a word you brought has no mentions at all — every one would sit permanently at the top and bury the course vocabulary that engine exists to rescue.</p>'+'<p class="lead" style="margin-top:1.3rem">Hata defteri · the mistake book</p>'+'<p>Until now every wrong answer vanished the moment the screen changed. The quiz kept a score, and the other modes kept a box number — so the explanation written for each question was shown once and thrown away, and nothing could tell you what you were getting wrong <b>repeatedly</b>.</p>'+'<p><b>Hata defteri</b> keeps all of it: what you were asked, what you said, what was right, and why. It is keyed by the question rather than kept as a log, so the count is the point — anything that has caught you twice or more goes to the top, and “four times” is a sentence the app can now say.</p>'+'<p>It is not another queue. Every mode already brings a wrong answer back the same day, so the drilling is already happening; this is the record, and the one place that answers “what keeps catching me”. Clearing an entry or the whole book changes nothing about the schedules.</p>'+'<p class="lead" style="margin-top:1.3rem">Yolda · hands-free</p>'+'<p><b>Yolda</b> is Üretim with the hands taken away, which turns out to be a different mode rather than a setting. The English is spoken to you, you answer out loud into the silence, the Turkish follows — and there is nothing to tap between starting and stopping, so it can be done while driving, walking or washing up. Sittings are five or ten minutes and the app stops itself.</p>'+'<p>The part that makes it Pimsleur rather than a playlist is that an item comes back <b>inside the same sitting</b> — three items later, then eight, then twenty — while it is still half remembered. A five-minute sitting covers a dozen or so phrases that way rather than rushing past fifty.</p>'+'<p>Marking happens once, at the end, when you have stopped: everything is taken as right and you tap the ones that got away. Nothing at all is written while the sitting runs, so abandoning one halfway costs you nothing rather than pushing a sentence you fumbled out to sixteen days.</p>'+'<p>One limit worth knowing before you rely on it: a phone stops speaking when its screen locks, on every platform. The app asks to hold the screen awake, which works on most recent browsers, but keep the phone unlocked and in a cradle rather than in a pocket.</p>'+'<p>A unit is ticked when you answer 80% of its questions correctly. Each level also has a <b>test ahead</b> exam: ten questions drawn from the whole level, and eight correct marks the level complete — so nothing you already know has to be sat through.</p>'+
  '<p>Your place is kept automatically; the home screen offers to resume it. Everything is stored in this browser only, so clearing site data clears your progress.</p>'+
  '<p class="lead" style="margin-top:1.3rem">Sık kelimeler · how many words</p>'+
  '<p>The units choose their words for their passages, which is what a reading course should do, and it leaves gaps: measured against a frequency list of spoken Turkish, the words they teach cover only around three quarters of what people actually say. <b>Sık kelimeler</b> fills the gap with the '+SIK.length+' commonest words the units never teach — <i>çünkü</i>, <i>zaten</i>, <i>lazım</i> — in the order they are needed. Once you have finished a unit, <b>Bugün</b> offers ten a day, and they join your reviews like any starred word.</p>'+
  '<p>With them, the words taught here cover roughly nine in ten words of everyday speech. Comprehension wants closer to nineteen in twenty, and the last stretch comes from reading, not from lists. That is also the honest limit of the C1 and C2 units: they teach the grammar and the register of those levels, but the vocabulary of an advanced reader runs to many thousands of words, and no course holds it.</p>'+
  '<p class="tiny">The frequency order comes from FrequencyWords by Hermit Dave (OpenSubtitles 2018), used under CC BY-SA 4.0; the selection, the order derived from it and the glosses are shared on the same terms.</p>'+
  '<p class="lead" style="margin-top:1.3rem">Konuşurken · how it is said</p>'+
  '<p>The units teach written Turkish, and people do not talk the way they write. <i>Gideceğim</i> is said <i>gidicem</i>, <i>bir şey</i> is <i>bişey</i>, <i>burada</i> is <i>burda</i>, and the answer to <i>Nereye gidiyorsun?</i> is <i>Eve</i>, not a whole sentence. From the first units, a <b>Konuşurken</b> card under the grammar shows the spoken form beside the written one and says who it is for: <b>with anyone</b>, or <b>between friends</b>.</p>'+
  '<p>Where you type an answer in Tekrar or Dilbilgisi, a spoken spelling of the right word counts as right, and the app shows you the written spelling, because that is the one you will read. It only recognises spoken forms of the answer\u2019s own words, so it never turns a wrong word into a right one. And whichever way you answer, the other ways are shown under <b>Başka türlü</b>: the spoken form of a written answer, the short form without the pronoun or the full form with it, and the other word where a vocabulary entry has two. The Kalıplar bank has a group of casual phrases, <i>naber</i>, <i>aynen</i>, <i>ne alaka</i>, each marked with who you would say it to. In the first Diyalog errands the other person talks casually too, and asking them to say it again gets you the careful version.</p>'+
  '<p>The forms here are the ones said all over Turkey and in ordinary Istanbul speech. Regional accents are left to the C2 unit on them, where they are the subject.</p>'+
  '<p class="lead" style="margin-top:1.3rem">Metinler · the texts</p>'+
  '<p>The reading difficulty climbs deliberately: invented dialogue at A1, anonymous folk tales at A2–B1, adapted short stories and essays at B2–C1, and Ottoman-era and mystical prose at C2.</p>'+
  '<p>Each passage says what it is. <b>Özgün metin</b> — written for this course. <b>Sadeleştirilmiş / yeniden anlatım</b> — anonymous folklore (Nasreddin Hoca, Keloğlan, Dede Korkut) retold in simplified Turkish. <b>Uyarlama</b> — a public-domain work (Ömer Seyfettin, Evliya Çelebi, Ziya Gökalp, Sabahattin Ali, the Mesnevî) whose situation and argument are retold here in graded modern Turkish rather than quoted.</p>'+
  '<p>If you want the originals, they are worth reading whole: Seyfettin’s <i>Kaşağı</i> and <i>Forsa</i>, Sabahattin Ali’s <i>Kürk Mantolu Madonna</i>, the <i>Dede Korkut Kitabı</i>, Evliya Çelebi’s <i>Seyahatnâme</i>.</p>'+
  '</div>'+
  '<div class="card" id="yedek"><p class="lead">Yedekle · back up</p>'+
  '<p class="sub">Progress lives in this browser only. Copy the text below and keep it somewhere — pasting it back restores everything, including on another device or another copy of the app.</p>'+
  (SAVEFAIL?'<p class="sub"><b>This browser is not saving right now.</b> Take a backup before closing the page, then paste it into a browser that saves — an ordinary window rather than a private one.</p>':'')+
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
  paint(h);
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
                   dinle:{},drate:S.drate,dreplay:S.dreplay,rep:{},gram:{},ygap:S.ygap,yrate:S.yrate,err:{},mine:[],
     num:{},nmax:S.nmax,ncap:S.ncap,dia:{},ata:{},sik:{},basla:{},tips:S.tips},o);
  if(!S.done)S.done={}; if(!S.star)S.star=[]; if(!S.srs)S.srs={}; if(!S.seen)S.seen={};
  if(!S.tested)S.tested={}; if(!S.days)S.days=[]; if(!S.basla)S.basla={};
  if(!S.prod)S.prod={}; if(!S.retell)S.retell={}; if(!S.dinle)S.dinle={}; if(!S.rep)S.rep={};
  save();
  if(S.rate)VOICE.rate=S.rate;
  home();
}
function wipe(){
  if(typeof confirm==="function"&&!confirm("Delete all progress, saved words and your place? This cannot be undone."))return;
  S={done:{},seen:{},place:null,star:[],tested:{},days:[],theme:S.theme,srs:{},rate:S.rate,
     prod:{},retell:{},gap:S.gap,prompten:S.prompten,pscope:S.pscope,
     dinle:{},drate:S.drate,dreplay:S.dreplay,rep:{},gram:{},ygap:S.ygap,yrate:S.yrate,err:{},mine:[],
     num:{},nmax:S.nmax,ncap:S.ncap,dia:{},ata:{},sik:{},basla:{},tips:S.tips,en:S.en};
  save(); home();
}

