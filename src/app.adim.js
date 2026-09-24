/* Derse başla: a unit taught in three lessons, one screen at a time.

   A unit is four tabs a learner moves between freely, which is right for
   someone who knows what they want and easy to drift through for someone
   who does not: a skimmed word list, a grammar tab never opened, no clear
   moment when the unit is done. This walks the same material in order and
   hands over to the unit's own five exercises, which are what tick it. It
   is the main way into a unit; the tabs stay underneath for browsing.
   Borrowed from the children's app, where it is the whole shape.

   It is three lessons, one a day in the plan (LESSON_DAY, app.core.js),
   because one sitting made a unit an afternoon and a level a day. Each
   lesson meets something new and brings back what came the day before:

     1  Kelimeler ve dilbilgisi — the ten words and their checks, then
        the grammar point (from A2, one example typed)
     2  Okuma — the passage line by line (from B1, heard before it is
        shown, then the words typed back into their sentences), three of
        its lines said aloud before they are heard, and the first half of
        the unit's common words
     3  Tekrar ve konuşma — the words recalled a day later, an example of
        the grammar (from A2), three more lines said aloud, the second
        half of the common words, the speaking task, then the exercises

   The checks grow with the learner, because what teaches at A1 is too
   easy to teach anything at B1: A1 hears and spells, A2 and up types the
   Turkish from the English. From B1 the passage's words are asked in
   their own sentences, after it is read, because a word blanked in a
   sentence the learner has not read yet is a guess.

   The common words are the unit's share of SIK (sikShare, app.sik.js),
   taken in exactly as Sık kelimeler takes them: starred, first review
   tomorrow, or marked known. The speaking task told here counts as its
   first telling, so the plan brings it back on day three and day seven.
   Otherwise it adds no material: each part marks its tab seen as it is
   shown (markSeen), so the reviews open exactly as if the tabs had been
   read, and S.ders records only which lessons are finished, and when.
   The checks are practice, not marks — nothing is scheduled or put in
   the mistake book, and one missed comes back later in the lesson. Typed
   answers are marked by wordOk() and sentOk(), the judges Tekrar and
   Dilbilgisi use, so a spoken spelling or the other "you" counts here as
   it does there. AD holds a run and, like Q and PR, survives a
   re-render. */

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
const DERS=[["Kelimeler ve dilbilgisi","words and grammar"],["Okuma","reading"],["Tekrar ve konuşma","review and speaking"]];
/* What the plan says about a unit's next lesson, and where it goes. */
function dersLabel(u,k){
  const base=u.lv+" · "+u.tr+" · ";
  return k<LESSONS?{en:base+"lesson "+(k+1)+" of 3",tt:base+"ders "+(k+1)+" / 3",go:"startAdim('"+u.id+"',"+k+")"}
                  :{en:base+"the exercises",tt:base+"alıştırmalar",go:"startUnitQuiz('"+u.id+"')"};
}
function adimHear(W,n){
  return shuffle(W).slice(0,n).map(function(w){
    return {t:"hear",w:w,opts:shuffle(shuffle(W.filter(function(x){return x.i!==w.i;})).slice(0,3).concat([w]))};
  });
}
function adimSpell(W,n){return shuffle(W.filter(adimSpellable)).slice(0,n).map(function(w){return {t:"spell",w:w,tiles:spellTiles(w.say)};});}
/* Three lines to say before they are heard: from the first half of the
   passage in lesson two, from the second in lesson three. */
function adimSayLines(u,half){
  const n=u.read.lines.length, m=Math.ceil(n/2), idx=[];
  for(let i=half?m:0;i<(half?n:m);i++)idx.push(i);
  return shuffle(idx).slice(0,3).sort(function(a,b){return a-b;}).map(function(i){return {t:"say",i:i};});
}
/* The unit's share of the common words, less any already met. */
function adimSik(u,half){
  const w=sikShare(u,half).filter(function(e){return !sikMet(e);});
  return w.length?[{t:"sik",words:w.map(function(e){return [e[0],e[1]];})}]:[];
}
function adimSteps(u,k){
  const tier=adimTier(u), W=adimWords(u);
  let steps=[];
  if(k===0){
    steps=W.map(function(w){return {t:"word",w:w};});
    steps=steps.concat(tier===0?adimHear(W,4).concat(adimSpell(W,3)):shuffle(W).slice(0,4).map(adimType));
    steps.push({t:"gram"});
    if(tier>0)steps.push(adimGex(u));
  }else if(k===1){
    steps=u.read.lines.map(function(l,i){return {t:"line",i:i};});
    if(tier===2){
      /* Words that have a sentence in this passage are asked in it; the
         rest are asked from the English, so there are always four. */
      const cl=[], rc=[];
      shuffle(W).forEach(function(w){const c=adimCloze(u,w); if(c)cl.push(c); else rc.push(adimType(w));});
      steps=steps.concat(cl.concat(rc).slice(0,4));
    }
    steps=steps.concat(adimSayLines(u,0),adimSik(u,0));
  }else{
    steps=tier===0?adimHear(W,3).concat(adimSpell(W,2)):shuffle(W).slice(0,4).map(adimType);
    if(tier>0)steps.push(adimGex(u));
    steps=steps.concat(adimSayLines(u,1),adimSik(u,1),[{t:"speak"}]);
  }
  steps.push({t:"end"});
  steps.forEach(function(s,i){s.id=i;});
  return steps;
}
/* k: the lesson, 0–2. Left out, the unit's next one — or the first,
   going over a unit whose three are done. */
function startAdim(id,k){
  const u=unit(id); if(!adimFor(u)||!unitOpen(id))return;
  if(!(k>=0&&k<LESSONS)){const n=dersNext(id);k=n<LESSONS?n:0;}
  stopPlay();
  AD={u:id,k:k,tier:adimTier(u),q:adimSteps(u,k),i:0,phase:"ask",sel:null,built:[],ok:null,shown:false,txt:false,
      typed:"",j:null,diag:null,heard:{},tries:{},known:{}};
  V={view:"adim",u:id};window.scrollTo(0,0);touchDay();render();
}
function adCur(){return AD&&AD.q[AD.i];}
function adNext(){
  if(!AD)return;
  stopPlay();
  AD.i=Math.min(AD.i+1,AD.q.length-1);
  AD.phase="ask";AD.sel=null;AD.built=[];AD.ok=null;AD.shown=false;AD.txt=false;AD.typed="";AD.j=null;AD.diag=null;AD.known={};
  window.scrollTo(0,0);render();
}
/* What is said once a check is answered: the word, the whole line, or the
   whole example. Never after a listening check — it was just heard. */
function adSaid(s){return s.t==="cloze"?s.full:s.t==="gex"?s.c:s.w?s.w.say:"";}
/* A missed check goes further down the line, to just before the lesson
   moves on from the words: the grammar, the lines said aloud, the common
   words, the speaking task, or the end. */
const AD_STOP={gram:1,say:1,sik:1,speak:1,end:1};
function adJudge(ok){
  const s=adCur(); if(!s)return;
  const n=(AD.tries[s.id]=(AD.tries[s.id]||0)+1);
  if(!ok&&n<=ADIM_RETRY){
    const again=Object.assign({},s,{retry:true});
    if(again.opts)again.opts=shuffle(again.opts);
    if(again.tiles)again.tiles=shuffle(again.tiles);
    const at=AD.q.findIndex(function(x,k){return k>AD.i&&AD_STOP[x.t];});
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
/* Said first, then heard: the Turkish is revealed and played. */
function adSay(){
  const s=adCur(); if(!s||s.t!=="say")return;
  AD.shown=true;render();
  say(unit(AD.u).read.lines[s.i][0],VOICE.rate);
}
function adKnow(j){if(AD){AD.known[j]=!AD.known[j];render();}}
function adSik(){
  const s=adCur(); if(!s||s.t!=="sik")return;
  s.words.forEach(function(e,j){if(!sikMet(e))sikTake(e,!!AD.known[j]);});
  save();adNext();
}
/* Told once here, it is the task's first telling; one already under way
   keeps its own schedule. */
function adSpeak(){
  if(!AD)return;
  const r=S.retell&&S.retell[AD.u];
  if(!r||!r.n)retellCount(AD.u);
  adNext();
}
function adText(){if(AD){AD.txt=true;render();}}

function renderAdim(){
  if(!AD){home();return;}
  const u=unit(AD.u), s=adCur();
  if(!u||!s){go("unit",AD.u,"v");return;}
  if(s.t==="word"&&!(S.seen[u.id]&&S.seen[u.id].v))markSeen(u.id,"v");
  if(s.t==="gram"&&!(S.seen[u.id]&&S.seen[u.id].g))markSeen(u.id,"g");
  if(s.t==="line"&&!(S.seen[u.id]&&S.seen[u.id].r))markSeen(u.id,"r");
  /* Reaching the end finishes the lesson, before the plan is read below. */
  if(s.t==="end")dersMark(u.id,AD.k);
  const typed=s.t==="type"||s.t==="cloze"||s.t==="gex";
  let h=bar(u.tr,u.lv+" · Ünite "+u.n+" · ders "+(AD.k+1)+" / "+LESSONS,true)+'<div class="wrap">';
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
  }else if(s.t==="say"){
    const ln=u.read.lines[s.i];
    h+='<p class="qn">Önce sen söyle</p><p class="src" style="margin:0 .2rem .6rem"><b>'+esc(u.read.t)+'</b> · '+(s.i+1)+' / '+u.read.lines.length+'</p>'+
      '<div class="card adl"><p class="q" style="margin:0">'+esc(ln[1])+'</p>'+
      (AD.shown?'<p class="adtr">'+esc(ln[0])+'</p>'+spkBtn(ln[0],{aria:"Listen"}):'')+'</div>'+
      (AD.shown?'<button class="btn" onclick="adNext()">Devam</button>'
               :'<p class="tiny" style="margin:0 .2rem .7rem">'+tx('Say it in Turkish, out loud, then check it against the model.','Türkçesini yüksek sesle söyle, sonra örnekle karşılaştır.')+'</p>'+
                '<button class="btn" onclick="adSay()">Göster</button>');
  }else if(s.t==="sik"){
    h+='<p class="qn">Sık kelimeler</p><p class="sub" style="margin:0 .2rem .8rem">'+
      tx('Words people say all the time that the units do not teach. Tap one to hear it, and mark any you already know. The rest go into your reviews, first review tomorrow.',
         'Herkesin sık kullandığı ama ünitelerin öğretmediği kelimeler. Dinlemek için dokun, bildiklerini işaretle. Kalanlar tekrarlarına eklenir; ilk tekrar yarın.')+'</p>'+
      '<div class="card" style="padding:.3rem 1rem">';
    s.words.forEach(function(e,j){
      const kn=!!AD.known[j];
      h+='<div class="vrow'+(kn?' known':'')+'">'+spkBtn(e[0],{aria:"Listen"})+
        '<div class="grow"><div class="vtr">'+esc(e[0])+'</div><div class="ven">'+esc(e[1])+'</div></div>'+
        '<button class="sbtn'+(kn?' on':'')+'" onclick="adKnow('+j+')">biliyorum</button></div>';
    });
    h+='</div><button class="btn" onclick="adSik()">Tekrara ekle</button>';
  }else if(s.t==="speak"){
    h+='<p class="qn">Konuş</p><div class="card"><p class="q" style="margin:0">'+esc(u.speak)+'</p></div>'+
      '<p class="sub" style="margin:0 .2rem .9rem">'+tx('Say it out loud, in Turkish, for a minute or so, with this unit’s words and pattern. Getting to the end matters more than getting it right. It comes back in your plan on day three and day seven.',
        'Yüksek sesle, Türkçe, bir dakika kadar anlat; bu ünitenin kelimelerini ve kalıbını kullan. Doğru söylemekten çok sonuna kadar gitmek önemli. Üçüncü ve yedinci gün planında yeniden gelecek.')+'</p>'+
      '<button class="btn" onclick="adSpeak()">Anlattım</button><button class="btn ghost" onclick="adNext()">Şimdi değil</button>';
  }else if(AD.k<LESSONS-1){
    /* Lessons one and two end on the rest of today's plan; the next
       lesson is tomorrow's, and offered here only while today has none. */
    const k=AD.k+1;
    h+='<div class="score"><div class="big pass">✓</div><p class="sub">Ders '+(AD.k+1)+' bitti</p></div>'+
      '<div class="card"><p class="sub">'+tx('Next: lesson '+(k+1)+', '+DERS[k][1]+'. One lesson a day gives the reviews time to bring this one back first.',
        'Sıradaki: '+(k+1)+'. ders, '+DERS[k][0].toLocaleLowerCase("tr")+'. Günde bir ders, tekrarların önce bunu geri getirmesine zaman tanır.')+'</p></div>'+
      planNext()+
      (dayFull()?'':'<button class="btn ghost" onclick="startAdim(\''+u.id+'\','+k+')">Sonraki ders →</button>')+
      '<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'v\')">Üniteye dön</button>';
  }else{
    h+='<div class="score"><div class="big pass">✓</div><p class="sub">Alıştırmalara hazırsın</p></div>'+
      '<div class="card"><p class="sub">'+tx("Over three lessons you have met the ten words, the grammar point and the whole passage. The five exercises tick the unit: four right out of five.",
        "Üç derste on kelimeyi, dilbilgisi konusunu ve metnin tamamını gördün. Üniteyi beş alıştırma tamamlar: beşte dört doğru yeterli.")+'</p>'+
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
