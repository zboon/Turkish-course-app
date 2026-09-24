/* Türkçe Macera — the screens: home and the map, a unit, a game in play,
   the result, and a page for grown-ups. */

/* ===================== macera · screens ===================== */
const IC={
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  spk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
};
function spk(t,cls){return '<button class="spk '+(cls||"")+'" onclick="event.stopPropagation();sayW(\''+jsq(t)+'\')" aria-label="Listen">'+IC.spk+'</button>';}
function starsHtml(n,of){let h='<span class="stars" aria-label="'+n+' of '+(of||3)+' stars">';for(let i=0;i<(of||3);i++)h+='<i class="'+(i<n?"on":"")+'">★</i>';return h+'</span>';}
function topbar(title,sub,backFn){
  return '<header class="top"><button class="ib" onclick="'+(backFn||"back()")+'" aria-label="Back">'+IC.back+'</button>'+
    '<div class="tt">'+lbl(title,sub)+'</div>'+
    '<button class="ib" onclick="toggleTheme()" aria-label="Theme">'+(themeDark()?IC.sun:IC.moon)+'</button></header>'+saveWarn();
}
function saveWarn(){
  return SAVEFAIL?'<div class="warn">This browser isn’t saving progress. Ask a grown-up to look at <b>For grown-ups</b>.</div>':'';
}
function voiceNote(){
  const st=voiceState();
  if(st==="notr")return '<div class="note">🔈 This device has no Turkish voice, so words may sound wrong. Ask a grown-up to add one — see <b>For grown-ups</b>.</div>';
  if(st==="none")return '<div class="note">🔇 This browser can’t speak, so you won’t hear the words. Everything else works.</div>';
  return "";
}

/* --- home ------------------------------------------------------------ */
function renderHome(){
  const rk=rank(), nr=nextRank(), due=reviewDue().length, ns=nextStep();
  let h='<header class="top home"><div class="brand"><span class="logo">🐱</span><span>'+lbl("Türkçe Macera","Turkish adventure")+'</span></div>'+
    '<button class="ib" onclick="toggleTheme()" aria-label="Theme">'+(themeDark()?IC.sun:IC.moon)+'</button></header>'+saveWarn();
  h+='<main class="wrap">';
  h+='<div class="hello"><div class="cat">🐱</div><div class="bubble">';
  if(!S.name){
    h+='<p><b>Merhaba!</b> I’m Pamuk, a cat from Istanbul. <b>Adın ne?</b> What’s your name?</p>'+
      '<div class="row"><input id="nbox" class="inp" maxlength="20" placeholder="Benim adım…" autocomplete="off">'+
      '<button class="btn sm" onclick="setName()">'+lbl("Tamam","okay")+'</button></div>';
  }else{
    h+='<p><b>Merhaba, '+esc(S.name)+'!</b> '+(streak()>1?'That’s '+streak()+' days in a row. ':'')+'Ready for some Turkish?</p>';
  }
  h+='</div></div>';
  h+='<div class="stats"><div><b>🔥 '+streak()+'</b><small>gün · days</small></div>'+
     '<div><b>'+rk[3]+' '+esc(rk[1])+'</b><small>'+esc(rk[2])+(nr?' · '+(nr[0]-S.xp)+' XP to '+esc(nr[2]):'')+'</small></div>'+
     '<div><b>⭐ '+S.xp+'</b><small>XP</small></div></div>';
  h+=voiceNote();
  h+='<h2>'+lbl("Bugün","today")+'</h2>';
  if(due)h+='<button class="task" onclick="startReview()"><span class="ti">🔁</span><span class="grow">'+lbl("Tekrar","review your words")+'<em>'+Math.min(due,KREVIEW)+' words waiting</em></span><span class="go">›</span></button>';
  if(ns){
    const nm=ns.n<3?LESSONS[ns.n]:["Kupa","trophy challenge","🏆"];
    h+='<button class="task main" onclick="'+(ns.n<3?"startLesson('"+ns.u.id+"',"+ns.n+")":"startCup('"+ns.u.id+"')")+'"><span class="ti">'+nm[2]+'</span>'+
      '<span class="grow">'+lbl(ns.u.tr+" · "+nm[0],ns.u.en+" · "+nm[1])+'</span><span class="go">›</span></button>';
  }else h+='<div class="task done">🏆 Every trophy is won. Tebrikler, congratulations.</div>';
  h+='<h2>'+lbl("Harita","the map")+'</h2><div class="map">';
  KUNITS.forEach(function(u,i){
    const open=unitOpen(u.id), won=cupWon(u.id), st=unitStars(u.id);
    h+='<button class="tile'+(open?"":" locked")+(won?" won":"")+'" onclick="go(\'unit\',\''+u.id+'\')">'+
      '<span class="num">'+(i+1)+'</span><span class="ico">'+(open?u.icon:"🔒")+'</span>'+
      '<span class="nm">'+lbl(u.tr,u.en)+'</span>'+
      (open?starsHtml(Math.round(st/3),3):'')+(won?'<span class="cup">🏆</span>':'')+'</button>';
  });
  h+='</div>';
  h+='<button class="link" onclick="go(\'parents\')">For grown-ups · Veliler için</button>';
  h+='<p class="foot">Türkçe Macera '+KAPP_VERSION+' · progress stays on this device</p></main>';
  paint(h);
}
function setName(){
  const b=document.getElementById("nbox"); if(!b)return;
  const v=String(b.value||"").replace(/[­​-‏⁠﻿]/g,"").trim().slice(0,20);
  if(!v)return;
  S.name=v; save(); say("Merhaba "+v,0.85); render();
}

/* --- a unit ------------------------------------------------------------ */
function renderUnit(){
  const u=kunit(V.u); if(!u){home();return;}
  const i=kidx(u.id);
  let h=topbar(u.tr,"Ünite "+(i+1)+" · "+u.en)+'<main class="wrap">';
  if(!unitOpen(u.id)){
    const pv=KUNITS[i-1];
    h+='<div class="card lock"><div class="big">🔒</div><p><b>Kilitli · locked</b></p>'+
      '<p>Win the trophy in <b>'+esc(pv.tr)+'</b> ('+esc(pv.en)+') to open this one.</p>'+
      '<button class="btn" onclick="go(\'unit\',\''+pv.id+'\')">'+lbl("Önceki ünite","the unit before")+'</button></div></main>';
    paint(h);return;
  }
  const p=prog(u.id);
  h+='<div class="uhead"><span class="uico">'+u.icon+'</span><div>'+lbl(u.tr,u.en)+'</div></div>';
  h+='<div class="lessons">';
  LESSONS.forEach(function(L,n){
    const open=lessonOpen(u.id,n);
    h+='<button class="lesson'+(open?"":" locked")+'" '+(open?'onclick="startLesson(\''+u.id+'\','+n+')"':'disabled')+'>'+
      '<span class="li">'+(open?L[2]:"🔒")+'</span><span class="grow">'+lbl((n+1)+". "+L[0],L[1])+'</span>'+starsHtml(p.l[n])+'</button>';
  });
  h+='<button class="lesson cupb'+(p.cup?" won":"")+'" onclick="startCup(\''+u.id+'\')"><span class="li">🏆</span><span class="grow">'+
    lbl("Kupa",p.cup?"trophy won · "+p.cup.score+"/"+CUP_N:"trophy challenge · "+CUP_PASS+" of "+CUP_N+" to win")+'</span><span class="go">›</span></button>';
  h+='</div>';
  if(!p.cup)h+='<p class="hint">Already know these? Try the trophy straight away: winning it opens the next unit.</p>';
  h+='<h2>'+lbl("Kelimeler","words")+'</h2><div class="words">';
  u.words.forEach(function(w){
    h+='<button class="word" onclick="sayW(\''+jsq(w[0])+'\')"><span class="em">'+w[2]+'</span><b>'+esc(w[0])+'</b><small>'+esc(w[1])+'</small></button>';
  });
  h+='</div>';
  h+='<h2>'+lbl("İpucu","tip")+'</h2><div class="card tip"><p><b>'+esc(u.tip.t)+'</b></p><p>'+esc(u.tip.en)+'</p>';
  u.tip.eg.forEach(function(e){h+='<div class="eg">'+spk(e[0].replace(" → ",", "))+'<span><b>'+esc(e[0])+'</b><small>'+esc(e[1])+'</small></span></div>';});
  h+='</div>';
  h+='<h2>'+lbl("Cümleler","phrases")+'</h2><div class="card">';
  u.phrases.forEach(function(ph){h+='<div class="eg">'+spk(ph[0])+'<span><b>'+esc(ph[0])+'</b><small>'+esc(ph[1])+'</small></span></div>';});
  h+='</div></main>';
  paint(h);
}

/* --- in play ----------------------------------------------------------- */
function renderPlay(){
  if(!G){home();return;}
  if(G.done){renderResult();return;}
  const r=cur(); if(!r){finish();return;}
  const title=G.kind==="review"?"Tekrar":G.kind==="cup"?"Kupa":LESSONS[G.n][0];
  const u=G.u?kunit(G.u):null;
  let h='<header class="top play"><button class="ib" onclick="back()" aria-label="Stop">'+IC.x+'</button>'+
    '<div class="bar"><i style="width:'+Math.round(100*G.i/G.q.length)+'%"></i></div>'+
    '<span class="xp">⭐ '+G.xp+'</span></header><main class="wrap game">';
  h+='<p class="kind">'+esc(title)+(u?' · '+esc(u.tr):'')+(r.retry?' · <em>again</em>':'')+'</p>';
  h+=roundHtml(r);
  if(G.phase==="fb"){
    h+='<div class="fb '+(G.ok?"ok":"no")+'"><p><b>'+(G.ok?esc(G.praise[0])+'</b> '+esc(G.praise[1]):'Neredeyse!</b> nearly')+'</p>'+
      '<p class="ans">'+answerLine(r)+'</p>'+
      (!G.ok&&G.kind!=="cup"&&r.t!=="match"?'<p class="small">This one comes back at the end.</p>':'')+
      '<button class="btn" onclick="next()">'+lbl("Devam","continue")+'</button></div>';
  }
  h+='</main>';
  paint(h);
  /* A heard round plays its word as it arrives, once — a redraw after a
     tap must not play it again. Learn cards do the same. */
  if((r.t==="hear"||r.t==="learn")&&G.phase==="ask"&&!G.heard[G.i]){G.heard[G.i]=1;say(r.w.tr,0.8);}
  const box=document.getElementById("kbox");
  if(box){try{box.focus();}catch(e){} box.addEventListener("keydown",function(e){if(e.key==="Enter")typeCheck();});}
}
function answerLine(r){
  if(r.t==="match")return G.m&&G.m.miss?G.m.miss+" wrong tap"+(G.m.miss>1?"s":"")+" on the way":"All matched first time.";
  if(r.p)return spk(r.p.tr,"sm")+'<b>'+esc(r.p.tr)+'</b> · '+esc(r.p.en);
  const exact=r.t==="type"&&G.ok&&G.typed.trim().toLocaleLowerCase("tr")!==r.w.tr;
  return spk(r.w.tr,"sm")+r.w.em+' <b>'+esc(r.w.tr)+'</b> · '+esc(r.w.en)+
    (exact?'<br><small>With Turkish letters it’s written <b>'+esc(r.w.tr)+'</b>.</small>':'');
}
function roundHtml(r){
  const lock=G.phase!=="ask";
  if(r.t==="learn"){
    return '<p class="q">'+lbl("Yeni kelime","new word")+'</p><div class="hero"><div class="em">'+r.w.em+'</div>'+
      '<div class="tr">'+esc(r.w.tr)+'</div><div class="en">'+esc(r.w.en)+'</div>'+spk(r.w.tr,"big")+'</div>'+
      '<button class="btn" onclick="next()">'+lbl("Devam","continue")+'</button>';
  }
  if(r.t==="talk"){
    const lines=kunit(r.u).talk;
    let h='<p class="q">'+lbl("Dinle ve oku","listen and read")+'</p><div class="comic">';
    lines.forEach(function(l,i){
      h+='<button class="say '+(i%2?"r":"l")+(G.line===i?" now":"")+'" onclick="talkLine('+i+')"><span class="who">'+(CAST[l[0]]||"🙂")+'<small>'+esc(l[0])+'</small></span>'+
        '<span class="sp"><b>'+esc(l[1])+'</b><small>'+esc(l[2])+'</small></span></button>';
    });
    return h+'</div><button class="btn ghost" onclick="talkPlay(0)">'+lbl("Hepsini dinle","hear it all")+'</button>'+
      '<button class="btn" onclick="next()">'+lbl("Devam","continue")+'</button>';
  }
  if(r.t==="hear"){
    let h='<p class="q">'+lbl("Ne duydun?","what did you hear?")+'</p><div class="center">'+spk(r.w.tr,"big")+'</div><div class="opts">';
    r.opts.forEach(function(o){
      const cls=lock?(o.k===r.w.k?" right":o.k===G.sel?" wrong":" dim"):"";
      h+='<button class="opt'+cls+'" '+(lock?"":'onclick="pick(\''+o.k+'\')"')+'><span class="em">'+o.em+'</span><small>'+esc(o.en)+'</small></button>';
    });
    return h+'</div>';
  }
  if(r.t==="see"){
    let h='<p class="q">'+lbl("Türkçesi ne?","what's this in Turkish?")+'</p><div class="hero sm"><div class="em">'+r.w.em+'</div><div class="en">'+esc(r.w.en)+'</div></div><div class="opts words">';
    r.opts.forEach(function(o){
      const cls=lock?(o.k===r.w.k?" right":o.k===G.sel?" wrong":" dim"):"";
      h+='<button class="opt txt'+cls+'" '+(lock?"":'onclick="pick(\''+o.k+'\')"')+'>'+esc(o.tr)+'</button>';
    });
    return h+'</div>';
  }
  if(r.t==="match"){
    const m=G.m||{sel:null,done:{},miss:0,bad:null};
    let h='<p class="q">'+lbl("Eşleştir","match the pairs")+'</p><p class="small">Tap a word to hear it, then its picture.</p><div class="match"><div class="col">';
    r.left.forEach(function(w){h+='<button class="mt'+(m.done[w.k]?" ok":m.sel===w.k?" sel":"")+'" '+(m.done[w.k]||lock?"disabled":'onclick="mTapL(\''+w.k+'\')"')+'>'+esc(w.tr)+'</button>';});
    h+='</div><div class="col">';
    r.right.forEach(function(w){h+='<button class="mt pic'+(m.done[w.k]?" ok":m.bad===w.k?" bad":"")+'" '+(m.done[w.k]||lock?"disabled":'onclick="mTapR(\''+w.k+'\')"')+'><span class="em">'+w.em+'</span><small>'+esc(w.en)+'</small></button>';});
    return h+'</div></div>';
  }
  if(r.t==="spell"){
    let h='<p class="q">'+lbl("Harfleri diz","spell it")+'</p><div class="hero sm"><div class="em">'+r.w.em+'</div><div class="en">'+esc(r.w.en)+'</div>'+spk(r.w.tr)+'</div>';
    h+='<div class="slots">'+G.built.map(function(i,j){return '<button class="lt on" '+(lock?"disabled":'onclick="tDel('+j+')"')+'>'+esc(r.tiles[i])+'</button>';}).join("")+
      (G.built.length?'':'<span class="ph">tap the letters</span>')+'</div><div class="tiles">';
    r.tiles.forEach(function(t,i){h+='<button class="lt'+(G.built.indexOf(i)>-1?" used":"")+'" '+(lock||G.built.indexOf(i)>-1?"disabled":'onclick="tAdd('+i+')"')+'>'+esc(t)+'</button>';});
    h+='</div>';
    if(!lock)h+='<button class="btn" onclick="spellCheck()" '+(G.built.length?"":"disabled")+'>'+lbl("Kontrol et","check")+'</button>';
    return h;
  }
  if(r.t==="order"){
    let h='<p class="q">'+lbl("Cümleyi kur","build the sentence")+'</p><div class="hero sm"><div class="en big">'+esc(r.p.en)+'</div></div>';
    h+='<div class="slots wide">'+G.built.map(function(i,j){return '<button class="wt on" '+(lock?"disabled":'onclick="tDel('+j+')"')+'>'+esc(r.tiles[i])+'</button>';}).join("")+
      (G.built.length?'':'<span class="ph">tap the words in order</span>')+'</div><div class="tiles">';
    r.tiles.forEach(function(t,i){h+='<button class="wt'+(G.built.indexOf(i)>-1?" used":"")+'" '+(lock||G.built.indexOf(i)>-1?"disabled":'onclick="tAdd('+i+')"')+'>'+esc(t)+'</button>';});
    h+='</div>';
    if(!lock)h+='<button class="btn" onclick="orderCheck()" '+(G.built.length?"":"disabled")+'>'+lbl("Kontrol et","check")+'</button>';
    return h;
  }
  if(r.t==="type"){
    let h='<p class="q">'+lbl("Yaz","type it in Turkish")+'</p><div class="hero sm"><div class="em">'+r.w.em+'</div><div class="en">'+esc(r.w.en)+'</div></div>';
    h+='<input id="kbox" class="inp big" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Türkçe…" '+
      (lock?'disabled value="'+esc(G.typed)+'"':'')+'>';
    if(!lock)h+='<p class="small">No Turkish keyboard? Type c for ç, s for ş, i for ı — it still counts.</p><button class="btn" onclick="typeCheck()">'+lbl("Kontrol et","check")+'</button>';
    return h;
  }
  if(r.t==="say"){
    let h='<p class="q">'+lbl("Sesli söyle","say it out loud")+'</p><div class="hero sm"><div class="en big">'+esc(r.p.en)+'</div></div>';
    if(G.phase==="ask")h+='<p class="small">Say it in Turkish, out loud, before you look.</p><button class="btn" onclick="sayShow()">'+lbl("Göster","show me")+'</button>';
    else if(G.phase==="reveal")h+='<div class="reveal">'+spk(r.p.tr)+'<b>'+esc(r.p.tr)+'</b></div><p class="small">Did you say it?</p>'+
      '<div class="two"><button class="btn ok" onclick="saySelf(true)">'+lbl("Söyledim","I said it")+'</button><button class="btn ghost" onclick="saySelf(false)">'+lbl("Henüz değil","not yet")+'</button></div>';
    return h;
  }
  return "";
}
function renderResult(){
  const res=G.res, u=G.u?kunit(G.u):null;
  let h='<header class="top play"><span></span><div class="tt">'+lbl("Bitti","finished")+'</div><span></span></header><main class="wrap center">';
  if(G.kind==="cup"){
    h+=res.pass?'<div class="big">🏆</div><h1>'+lbl("Kupa senin!","the trophy is yours")+'</h1>':'<div class="big">💪</div><h1>'+lbl("Az kaldı!","so close")+'</h1>';
    h+='<p class="score">'+G.first+' / '+G.scored+' first try</p>';
    h+=res.pass?(res.opened?'<div class="card new">🔓 New unit open: <b>'+esc(res.opened.tr)+'</b> · '+esc(res.opened.en)+'</div>':'')
               :'<p>You need '+CUP_PASS+'. Play the lessons again, then have another go.</p>';
  }else if(G.kind==="review"){
    h+='<div class="big">🔁</div><h1>'+lbl("Tekrar bitti","review done")+'</h1><p class="score">'+G.first+' / '+G.scored+' first try</p>'+
      '<p>Words you got right come back in a few days; the others come back tomorrow.</p>';
  }else{
    h+='<div class="big">'+["","🙂","😀","🤩"][res.stars]+'</div><h1>'+lbl(["","İyi","Çok iyi","Mükemmel"][res.stars],["","good","very good","perfect"][res.stars])+'</h1>'+
      starsHtml(res.stars)+'<p class="score">'+G.first+' / '+G.scored+' first try</p>';
  }
  h+='<p class="xpgain">+'+G.xp+' XP</p>';
  if(u)h+='<button class="btn" onclick="go(\'unit\',\''+u.id+'\')">'+lbl("Devam","continue")+'</button>';
  else h+='<button class="btn" onclick="home()">'+lbl("Ana sayfa","home")+'</button>';
  if(G.kind==="cup"&&!res.pass)h+='<button class="btn ghost" onclick="startCup(\''+u.id+'\')">'+lbl("Tekrar dene","try again")+'</button>';
  h+='</main>';
  paint(h);
}

/* --- for grown-ups ---------------------------------------------------- */
function renderParents(){
  let h=topbar("Veliler için","for grown-ups")+'<main class="wrap">';
  h+='<div class="card prose"><p><b>What this is.</b> Twelve short units of beginner Turkish for 11–13 year olds starting from English: words, useful phrases, one grammar tip each and a short comic, played as small games. It is the children’s companion to a full A1–C2 course.</p>'+
    '<p><b>How it works.</b> Each unit has three lessons and a trophy challenge. Winning the trophy (8 of 10, first try only) opens the next unit, and it can be tried straight away to skip a unit already known. Words from finished lessons come back in a daily review, spaced further apart each time they are remembered.</p>'+
    '<p><b>Privacy.</b> No account, no adverts, nothing sent anywhere. Progress is stored in this browser only.</p>'+
    '<p><b>The voice.</b> Words are spoken by the device’s own Turkish voice. '+
    (voiceState()==="ok"?'This device has one.':voiceState()==="notr"?'This device has no Turkish voice yet, so Turkish is read with the wrong accent. On iPhone and iPad: Settings → Accessibility → Spoken Content → Voices → Turkish. On Android: Settings → Text-to-speech → install Turkish. On Windows: Settings → Time & language → Speech → add Turkish. Then reload.':voiceState()==="none"?'This browser has no speech at all; try another browser.':'')+'</p></div>';
  h+='<h2>'+lbl("Ayarlar","settings")+'</h2><div class="card"><label class="sw"><input type="checkbox" '+(S.snd?"checked":"")+' onchange="S.snd=this.checked;save()"> Answer sounds</label>'+
    '<div class="row"><input id="rname" class="inp" maxlength="20" value="'+esc(S.name)+'" placeholder="Name"><button class="btn sm" onclick="rename()">'+lbl("Kaydet","save")+'</button></div></div>';
  h+='<h2>'+lbl("Yedek","backup")+'</h2><div class="card"><p class="small">To move progress to another browser: copy it here, then paste it into the same box there.</p>'+
    '<textarea id="iobox" class="inp" rows="3"></textarea><div class="two"><button class="btn ghost" onclick="exportBox()">'+lbl("Kopyala","copy")+'</button>'+
    '<button class="btn ghost" onclick="importBox()">'+lbl("Geri yükle","restore")+'</button></div><p class="small" id="iomsg"></p></div>';
  h+='<button class="btn danger" onclick="wipe()">'+lbl("Baştan başla","delete all progress")+'</button>';
  h+='<p class="foot">Türkçe Macera '+KAPP_VERSION+'</p></main>';
  paint(h);
}
function rename(){const b=document.getElementById("rname"); if(!b)return; S.name=String(b.value||"").trim().slice(0,20); save(); render();}
function ioMsg(t){const e=document.getElementById("iomsg"); if(e)e.textContent=t;}
function exportBox(){
  const b=document.getElementById("iobox"); if(!b)return;
  b.value=JSON.stringify(S);
  try{b.select();}catch(e){}
  let done=false;
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(b.value);done=true;}}catch(e){}
  ioMsg(done?"Copied. Paste it somewhere safe.":"Select the text above and copy it.");
}
function importBox(){
  const b=document.getElementById("iobox"); if(!b)return;
  let o=null; try{o=JSON.parse(String(b.value||"").trim());}catch(e){}
  if(!o||typeof o!=="object"||Array.isArray(o)||typeof o.u!=="object"){ioMsg("That text could not be read.");return;}
  S=Object.assign({name:"",u:{},srs:{},xp:0,days:[],theme:S.theme,snd:S.snd},o);
  load2(); save(); home();
}
function load2(){if(!S.u)S.u={}; if(!S.srs)S.srs={}; if(!S.days)S.days=[]; if(typeof S.xp!=="number")S.xp=0;}
function wipe(){
  if(typeof confirm==="function"&&!confirm("Delete all progress in Türkçe Macera? This cannot be undone."))return;
  S={name:"",u:{},srs:{},xp:0,days:[],theme:S.theme,snd:S.snd}; save(); home();
}
