/* Derse başla: a unit taught one screen at a time.

   A unit is four tabs a learner moves between freely, which is right for
   someone who knows what they want and easy to drift through for someone
   who does not: a skimmed word list, a grammar tab never opened, no clear
   moment when the unit is done. This walks the same material in order and
   hands over to the unit's own five exercises, which are what tick it. It
   is the main way into a unit; the tabs stay underneath for browsing.
   Borrowed from the children's app, where it is the whole shape.

   The order is the same at every level; the checks grow with the learner,
   because what teaches at A1 is too easy to teach anything at B1:

     A1  words with pictures · hear and pick · spell from tiles ·
         grammar · the passage line by line
     A2  words · type the Turkish from the English · grammar, then type
         one example · the passage line by line
     B1+ words · grammar, then type one example · the passage heard before
         it is shown · the words typed back into their own sentences

   From B1 the checks come after the passage, because a word blanked in a
   sentence the learner has not read yet is a guess.

   It adds no material and no storage: each part marks its tab seen as it
   is shown (markSeen, the same record the tabs write), so the reviews
   open exactly as if the tabs had been read. The checks are practice,
   not marks — nothing is scheduled or put in the mistake book, and one
   missed comes back later in the lesson. Typed answers are marked by
   wordOk() and sentOk(), the judges Tekrar and Dilbilgisi use, so a
   spoken spelling or the other "you" counts here as it does there.
   AD holds a run and, like Q and PR, survives a re-render. */

/* ===================== ders · the guided lesson ===================== */
const ADIM_RETRY=2;
let AD=null;
function adimFor(u){return !!u;}
/* 0 — A1, 1 — A2, 2 — B1 and up. */
function adimTier(u){return u.lv==="A1"?0:u.lv==="A2"?1:2;}
function adimWords(u){
  return u.vocab.map(function(w,i){
    return {i:i,tr:w[0],say:vocabPrimary(w[0]).replace(/[?.!]+$/,""),en:w[1],em:RESIM[w[0]]||""};
  });
}
function adimSpellable(w){return /^[a-zçğıöşüâîû]+$/.test(w.say)&&w.say.length<=10;}
/* The word blanked in a line of the unit's own passage, the form the line
   uses — the same builder Tekrar uses, restricted to this unit. A line
   that uses the word twice is skipped: the answer would be on screen. */
function adimCloze(u,w){
  const forms=vocabForms(w.tr);
  for(let f=0;f<forms.length;f++){
    for(let li=0;li<u.read.lines.length;li++){
      const line=u.read.lines[li], raw=line[0].split(/\s+/);
      if(repHits(raw,forms[f])!==1)continue;
      const span=repSpan(raw,forms[f]); if(!span)continue;
      const run=raw.slice(span[0],span[0]+span[1]).join(" ");
      const m=REP_EDGE.exec(run), core=m?m[2]:run;
      if(!core)continue;
      const blanked=raw.slice();
      blanked.splice(span[0],span[1],(m?m[1]:"")+"___"+(m?m[3]:""));
      return {t:"cloze",w:w,q:blanked.join(" "),c:core,alts:[fold(core)],hint:line[1],full:line[0]};
    }
  }
  return null;
}
function adimType(w){return {t:"type",w:w,c:w.say,alts:vocabForms(w.tr)};}
function adimGex(u){const e=pick(u.gram.eg);return {t:"gex",c:e[0],en:e[1]};}
function adimSteps(u){
  const tier=adimTier(u), W=adimWords(u), steps=W.map(function(w){return {t:"word",w:w};});
  const lines=u.read.lines.map(function(l,i){return {t:"line",i:i};});
  if(tier===0){
    shuffle(W).slice(0,4).forEach(function(w){
      steps.push({t:"hear",w:w,opts:shuffle(shuffle(W.filter(function(x){return x.i!==w.i;})).slice(0,3).concat([w]))});
    });
    shuffle(W.filter(adimSpellable)).slice(0,3).forEach(function(w){steps.push({t:"spell",w:w,tiles:spellTiles(w.say)});});
    steps.push({t:"gram"});
    lines.forEach(function(s){steps.push(s);});
  }else if(tier===1){
    shuffle(W).slice(0,4).forEach(function(w){steps.push(adimType(w));});
    steps.push({t:"gram"},adimGex(u));
    lines.forEach(function(s){steps.push(s);});
  }else{
    steps.push({t:"gram"},adimGex(u));
    lines.forEach(function(s){steps.push(s);});
    /* Words that have a sentence in this passage are asked in it; the
       rest are asked from the English, so there are always four. */
    const sh=shuffle(W), cl=[], rc=[];
    sh.forEach(function(w){const c=adimCloze(u,w); if(c)cl.push(c); else rc.push(adimType(w));});
    cl.concat(rc).slice(0,4).forEach(function(s){steps.push(s);});
  }
  steps.push({t:"end"});
  steps.forEach(function(s,i){s.id=i;});
  return steps;
}
function startAdim(id){
  const u=unit(id); if(!adimFor(u)||!unitOpen(id))return;
  stopPlay();
  AD={u:id,tier:adimTier(u),q:adimSteps(u),i:0,phase:"ask",sel:null,built:[],ok:null,shown:false,txt:false,
      typed:"",j:null,diag:null,heard:{},tries:{}};
  V={view:"adim",u:id};window.scrollTo(0,0);touchDay();render();
}
function adCur(){return AD&&AD.q[AD.i];}
function adNext(){
  if(!AD)return;
  stopPlay();
  AD.i=Math.min(AD.i+1,AD.q.length-1);
  AD.phase="ask";AD.sel=null;AD.built=[];AD.ok=null;AD.shown=false;AD.txt=false;AD.typed="";AD.j=null;AD.diag=null;
  window.scrollTo(0,0);render();
}
/* What is said once a check is answered: the word, the whole line, or the
   whole example. Never after a listening check — it was just heard. */
function adSaid(s){return s.t==="cloze"?s.full:s.t==="gex"?s.c:s.w?s.w.say:"";}
/* A missed check goes further down the line — before the grammar at A1
   and A2, so the words are settled before the unit moves on from them,
   and before the end from B1, where the checks come last. */
function adJudge(ok){
  const s=adCur(); if(!s)return;
  const n=(AD.tries[s.id]=(AD.tries[s.id]||0)+1);
  if(!ok&&n<=ADIM_RETRY){
    const again=Object.assign({},s,{retry:true});
    if(again.opts)again.opts=shuffle(again.opts);
    if(again.tiles)again.tiles=shuffle(again.tiles);
    const before=AD.tier<2&&s.t!=="gex"?"gram":"end";
    const at=AD.q.findIndex(function(x,k){return k>AD.i&&x.t===before;});
    AD.q.splice(at<0?AD.q.length-1:at,0,again);
  }
  AD.ok=ok;AD.phase="fb";render();
  if(s.t!=="hear")say(adSaid(s),0.85);
}
function adPick(i){const s=adCur(); if(!s||AD.phase!=="ask")return; AD.sel=i; adJudge(i===s.w.i);}
function adAdd(i){if(!AD||AD.phase!=="ask"||AD.built.indexOf(i)>-1)return; AD.built.push(i); render();}
function adDel(j){if(!AD||AD.phase!=="ask")return; AD.built.splice(j,1); render();}
function adSpell(){
  const s=adCur(); if(!s||!AD.built.length)return;
  adJudge(AD.built.map(function(i){return s.tiles[i];}).join("")===s.w.say);
}
function adType(){
  const s=adCur(); if(!s||AD.phase!=="ask")return;
  const box=document.getElementById("abox"); if(box)AD.typed=box.value;
  if(!fold(AD.typed))return;
  if(s.t==="gex"){
    AD.j=sentOk(s.c,AD.typed,s.en);
    AD.diag=AD.j.res.same?[]:diagnoseLine(s.c,AD.typed,2);
    adJudge(AD.j.res.same);
  }else{
    AD.j=wordOk(AD.typed,s.alts,s.t==="cloze"?s.q:"",s.t==="cloze"?s.hint:s.w.en);
    const d=AD.j.ok?null:diagAny(AD.typed,s.c);
    AD.diag=d?[d]:[];
    adJudge(AD.j.ok);
  }
}
function adShow(){if(AD){AD.shown=true;render();}}
function adText(){if(AD){AD.txt=true;render();}}

function renderAdim(){
  if(!AD){home();return;}
  const u=unit(AD.u), s=adCur();
  if(!u||!s){go("unit",AD.u,"v");return;}
  if(s.t==="word"&&!(S.seen[u.id]&&S.seen[u.id].v))markSeen(u.id,"v");
  if(s.t==="gram"&&!(S.seen[u.id]&&S.seen[u.id].g))markSeen(u.id,"g");
  if(s.t==="line"&&!(S.seen[u.id]&&S.seen[u.id].r))markSeen(u.id,"r");
  const typed=s.t==="type"||s.t==="cloze"||s.t==="gex";
  let h=bar(u.tr,u.lv+" · Ünite "+u.n+" · ders",true)+'<div class="wrap">';
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
  }else if(s.t==="type"){
    h+='<p class="qn">Türkçesini yaz</p><div class="card adw">'+(s.w.em?'<div class="pic">'+s.w.em+'</div>':'')+'<div class="vtr">'+esc(s.w.en)+'</div></div>';
  }else if(s.t==="cloze"){
    h+='<p class="qn">Boşluğu doldur</p><p class="q" style="font-family:\'Crimson Pro\',serif;font-size:1.3rem;font-weight:600">'+
      esc(s.q).replace(/___/g,'<span class="blank">____</span>')+'</p><p class="sub" style="margin:-.5rem 0 .9rem">'+esc(s.hint)+'</p>';
  }else if(s.t==="gex"){
    h+='<p class="qn">Sen de dene</p><p class="tiny" style="margin:0 .2rem .3rem">'+esc(u.gram.t)+'</p><p class="q">'+esc(s.en)+'</p>';
  }else if(s.t==="gram"){
    h+='<p class="qn">Dilbilgisi</p>'+gramCard(u)+spokenCard(u)+'<button class="btn" onclick="adNext()">Devam</button>';
  }else if(s.t==="line"){
    const ln=u.read.lines[s.i], hid=AD.tier===2&&!AD.txt;
    h+='<p class="qn">Okuma</p><p class="src" style="margin:0 .2rem .6rem"><b>'+esc(u.read.t)+'</b> · '+(s.i+1)+' / '+u.read.lines.length+'</p>'+
      '<div class="card adl">'+(hid?'<p class="adtr adhid">🎧</p>':'<p class="adtr">'+glossify(ln[0],u.read.gloss)+'</p>')+spkBtn(ln[0],{aria:"Listen"})+
      (AD.shown&&!hid?'<p class="aden">'+esc(ln[1])+'</p>':'')+'</div>'+
      (hid?'<button class="btn ghost" onclick="adText()">Metni göster</button>':AD.shown?'':'<button class="btn ghost" onclick="adShow()">İngilizcesi</button>')+
      '<button class="btn" onclick="adNext()">Devam</button>';
  }else{
    h+='<div class="score"><div class="big pass">✓</div><p class="sub">Alıştırmalara hazırsın</p></div>'+
      '<div class="card"><p class="sub">'+tx("You have met the ten words, the grammar point and the whole passage. The five exercises tick the unit: four right out of five.",
        "On kelimeyi, dilbilgisi konusunu ve metnin tamamını gördün. Üniteyi beş alıştırma tamamlar: beşte dört doğru yeterli.")+'</p>'+
      '<button class="btn" onclick="startUnitQuiz(\''+u.id+'\')">Alıştırmalara geç →</button>'+
      '<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'v\')">Üniteye dön</button></div>';
  }
  if(typed&&AD.phase==="ask"){
    h+='<input class="inp" id="abox" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Türkçe yaz…" value="'+esc(AD.typed)+'">'+
      '<button class="btn" onclick="adType()">Kontrol et</button>';
  }
  if(AD.phase==="fb")h+=adFeedback(s);
  h+='</div>';
  paint(h);
  const box=document.getElementById("abox");
  if(box){box.focus();box.addEventListener("keydown",function(e){if(e.key==="Enter")adType();});}
  /* A word or a line plays as it arrives, once; a redraw after a tap
     must not play it again. */
  if(AD.phase==="ask"&&!AD.heard[AD.i]&&(s.t==="word"||s.t==="hear"||s.t==="line")){
    AD.heard[AD.i]=1;
    say(s.t==="line"?u.read.lines[s.i][0]:s.w.say,s.t==="line"?VOICE.rate:0.8);
  }
}
function adFeedback(s){
  const back=AD.ok?"":'<br><span class="tiny">'+tx("This one comes back later in the lesson.","Bu soru derste yeniden gelecek.")+'</span>';
  let ans;
  if(s.t==="gex"){
    const r=AD.j.res;
    ans='<p class="dline">'+r.ops.map(function(o){return '<span class="dw '+(o.t==="ok"?"":o.t)+'">'+esc(o.w)+'</span>';}).join(" ")+'</p>'+
      (r.same?'':'<p>'+esc(s.c)+'</p>');
  }else if(s.t==="cloze"){
    ans=' '+esc(s.full);
  }else{
    ans=(s.w.em?' '+s.w.em:'')+' '+esc(s.w.say)+' — '+esc(s.w.en);
  }
  let notes="";
  if(AD.j){
    notes=AD.ok?spokenBox(AD.j.spoken,s.c)+sizBox(AD.j.siz,s.c):diagBox(AD.diag);
  }
  return '<div class="fb '+(AD.ok?"ok":"no")+'"><b>'+(AD.ok?"Doğru":"Yanlış")+'</b>'+ans+back+notes+'</div>'+
    '<button class="btn" onclick="adNext()">Devam</button>';
}
