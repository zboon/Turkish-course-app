/* Tekrar motoru: the repetition engine, and the daily plan built on top of
   every mode's due counts. */

/* ===================== tekrar · the repetition engine ===================== */
/* The course teaches 600 words and then mostly never mentions them again.
   Measured across every Turkish string the app can show — vocabulary
   lists, passages, grammar bodies and tables, all 300 drills, the chunks —
   the median taught word is met three times, 182 of them exactly once, and
   only 105 reach eight.
   The acquisition literature puts durable retention somewhere around eight
   to twenty meaningful encounters, so most of the course's own vocabulary
   is decoration: seen, never returned to.

   Nothing here adds material. It counts what the app already exposes and
   then drills whatever the app will not bring back on its own, worst
   served first, so the floor rises instead of the ceiling.

   Two exercises, both retrieval rather than recognition, because a word
   you can pick out of four options is not a word you can say:

   - **cloze** where the word appears in a real passage line — the line
     comes back with that word blanked, and the answer is the form the
     sentence uses, so "aile" is asked as "ailem". 343 of the 600 get one;
     108 of those ask for an inflected form rather than the headword.
   - **recall** where it does not — English prompt, type the Turkish. The
     once-only words mostly land here, because a word that appears in no
     sentence has no context to blank.

   Keys are permanent, like unit ids: fold(word), so "kaşağı" is stored as
   "kasagi". Changing a vocabulary entry's spelling re-points its schedule,
   which is the same hazard as renumbering a unit — see the storage note in
   CLAUDE.md. TK holds a run and has to survive a re-render. */
const REP_TARGET=8;                  /* encounters we want each word to reach */
const REP_SESSION=10;
let TK=null;

/* --- the index ------------------------------------------------------- */
/* Built once and memoised: ~15,500 tokens is cheap to walk, but not on
   every paint, and the home screen asks for these counts. */
/* A vocabulary entry is not always one word. "ad / isim" is two
   alternatives, "ağabey (abi)" is a word and its colloquial form, and
   "hafta sonu" is a single two-word noun. Folding them naively gives
   "ad isim" and "agabey abi", which appear nowhere, so those entries
   scored zero and got no context to blank — the bug this splitting
   exists to prevent. Alternatives are counted separately and the entry
   takes the best-served one, because that is what decides whether the
   app will bring the entry back at all. */
function vocabForms(tr){
  const out=[];
  /* Parentheses hold an alternative, not an apposition: "ağabey (abi)" is
     two words for one thing, so both are pulled out as candidates. */
  const parens=[];
  const base=String(tr).replace(/\(([^)]*)\)/g,function(_,inner){parens.push(inner);return " ";});
  base.split("/").concat(parens.join("/").split("/")).forEach(function(part){
    const f=fold(part);
    if(f&&out.indexOf(f)<0)out.push(f);
  });
  return out;
}
/* The first alternative as it is written, for showing back to the learner:
   "ağabey (abi)" → "ağabey", "ad / isim" → "ad". */
function vocabPrimary(tr){
  return String(tr).replace(/\([^)]*\)/g," ").split("/")[0].replace(/\s+/g," ").trim()||String(tr);
}
/* Turkish glues suffixes on, so a prefix test is the right shape — but it
   is far too loose for a short stem: "ad" prefixes "adam" and "ada", which
   are unrelated words, and counting those would inflate exactly the number
   this engine exists to reduce. So prefix matching applies from four
   characters up, and shorter forms must match exactly.
   Verbs undercount either way, because the infinitive "gitmek" is not a
   prefix of "gidiyorum". Both errors run the same direction — fewer
   encounters claimed than met — which is the safe one for a floor. */
const REP_PREFIX_MIN=4;
function repMatches(token,form){
  return token===form||(form.length>=REP_PREFIX_MIN&&token.indexOf(form)===0);
}
/* One written word, folded — NOT fold() split on spaces. fold() turns
   "Kapadokya'ya" into "kapadokya ya", and indexing those halves separately
   made the dative suffix on a place name look like an occurrence of the
   particle "ya", which is a taught word. Keeping each written word whole
   means the index and repSpan below tokenise identically, so they cannot
   disagree about where a word occurs. */
function repTokens(s){
  return String(s).split(/\s+/).map(fold).filter(function(t){return t.length>0;});
}
let WIDX=null;
function wordIndex(){
  if(WIDX)return WIDX;
  const freq={}, atToken={}, all=[];  /* folded word -> count, -> [[unitId,line]], and every string */
  function count(s){
    const f=fold(s);
    if(f)all.push(f);
    repTokens(s).forEach(function(t){ freq[t]=(freq[t]||0)+1; });
  }
  UNITS.forEach(function(u){
    u.vocab.forEach(function(w){count(w[0]);});
    u.gram.eg.forEach(function(e){count(e[0]);});
    u.gram.body.forEach(function(b){count(b.replace(/<[^>]*>/g," "));});
    (u.gram.tbl||[]).forEach(function(r){count(r[0]+" "+r[1]);});
    u.drill.forEach(function(d){
      count(d.q);
      if(d.c)count(String(d.c));
      (d.a||[]).forEach(count);
      (d.w||[]).forEach(count);
    });
    u.read.lines.forEach(function(ln,i){
      count(ln[0]);
      repTokens(ln[0]).forEach(function(t){
        if(!atToken[t])atToken[t]=[];
        atToken[t].push([u.id,i]);
      });
    });
  });
  CHUNKS.forEach(function(c){count(c[0]);});
  const corpus=all.join(" \u0001 ");   /* a separator no fold() output contains */

  /* A single word's encounters, by repMatches above. A phrase is searched
     across the whole corpus rather than only the passages, or "hafta sonu"
     scores zero for appearing in a drill instead of a story. */
  const toks=Object.keys(freq);
  function score(f){
    let n=0, where=[];
    if(f.indexOf(" ")>-1){
      let i=0;
      while((i=corpus.indexOf(f,i))>-1){n++;i+=f.length;}
      UNITS.forEach(function(u2){
        u2.read.lines.forEach(function(ln,i2){
          if(fold(ln[0]).indexOf(f)>-1)where.push([u2.id,i2]);
        });
      });
    }else{
      toks.forEach(function(t){
        if(repMatches(t,f)){
          n+=freq[t];
          (atToken[t]||[]).forEach(function(p){where.push(p);});
        }
      });
    }
    return {n:n,where:where};
  }
  const words=[];
  UNITS.forEach(function(u){
    u.vocab.forEach(function(w){
      const forms=vocabForms(w[0]);
      if(!forms.length)return;
      let best={n:-1,where:[]}, bestForm=forms[0];
      forms.forEach(function(f){
        const r=score(f);
        if(r.n>best.n){best=r;bestForm=f;}
      });
      words.push({tr:w[0],en:w[1],unit:u.id,lv:u.lv,
                  k:fold(w[0]),form:bestForm,nat:best.n,where:best.where});
    });
  });
  WIDX={words:words,freq:freq};
  return WIDX;
}
/* Natural encounters plus the ones this engine has supplied. */
function repTotal(e){
  const r=S.rep&&S.rep[e.k];
  return e.nat+((r&&r.n)||0);
}
function repBank(){
  return wordIndex().words.slice().sort(function(a,b){
    const d=repTotal(a)-repTotal(b);
    return d||(a.k<b.k?-1:1);       /* stable: same total, alphabetical */
  });
}
function repShort(){                 /* still under the target */
  return repBank().filter(function(e){return repTotal(e)<REP_TARGET;});
}
function repDue(){
  return repShort().filter(function(e){return isDue(S.rep,e.k);});
}
/* Reviews first, oldest due first, then the worst-served words never
   drilled — the same shape as Üretim and Dinleme, over a different bank. */
function repQueue(){
  return dueQueue(S.rep,repShort(),REP_SESSION);
}
function repGrade(k,good){
  if(!S.rep)S.rep={};
  const r=bump(S.rep,k,function(b){return good?b+1:0;});
  r.n=(r.n||0)+1;                    /* a drill is an encounter either way */
  save();
}
/* The distribution, so the thing this engine exists to move is visible. */
function repBands(){
  const b=[0,0,0,0,0];               /* 1 · 2–3 · 4–7 · 8–20 · 21+ */
  repBank().forEach(function(e){
    const n=repTotal(e);
    if(n<=1)b[0]++; else if(n<=3)b[1]++; else if(n<=7)b[2]++; else if(n<=20)b[3]++; else b[4]++;
  });
  return b;
}

/* --- building one question ------------------------------------------- */
/* Cloze when the word lives in a real sentence, recall when it does not.
   The cloze answer is the form the line actually uses — kitap asked as
   kitabı — which is the harder and more useful target.
   `e.form` is the alternative that scored, so "ad / isim" is blanked
   wherever "ad" occurs rather than looked for as a phrase. */
function repSpan(raw,form){
  /* Which run of written words covers this word or phrase? Returns
     [start, length] or null.
     A phrase inflects on its last word — "karşı kıyı" turns up as
     "Karşı kıyının" — so the run is matched by prefix just as the counter
     matches it in the corpus. Matching the two differently is what let the
     index record contexts the cloze builder could not then blank. */
  const want=form.split(" ").length;
  for(let i=0;i+want<=raw.length;i++){
    const run=raw.slice(i,i+want).map(fold).join(" ");
    if(run===form||(form.length>=REP_PREFIX_MIN&&run.indexOf(form)===0))return [i,want];
  }
  return null;
}
/* A token carries the sentence's punctuation — "kaşağı," or "kitap." — and
   blanking the whole token would take the comma with it and then ask the
   learner to type it back. Split the run into what is punctuation and what
   is word, blank only the word, and leave the rest where it was: the
   learner sees "___," and answers "kaşağı". */
const REP_EDGE=/^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;
/* How many written words in this line match the form? A line that uses
   the word twice cannot be a cloze: blanking one occurrence leaves the
   answer sitting in the prompt. */
function repHits(raw,form){
  const want=form.split(" ").length;
  let n=0;
  for(let i=0;i+want<=raw.length;i++){
    const run=raw.slice(i,i+want).map(fold).join(" ");
    if(run===form||(form.length>=REP_PREFIX_MIN&&run.indexOf(form)===0))n++;
  }
  return n;
}
function repItem(e){
  for(let a=0;a<e.where.length;a++){
    const p=e.where[a], u=unit(p[0]);
    if(!u||!u.read.lines[p[1]])continue;
    const line=u.read.lines[p[1]], raw=line[0].split(/\s+/);
    if(repHits(raw,e.form)!==1)continue;      /* the answer would be on screen */
    const span=repSpan(raw,e.form);
    if(!span)continue;
    const run=raw.slice(span[0],span[0]+span[1]).join(" ");
    const m=REP_EDGE.exec(run);
    const core=m?m[2]:run;
    if(!core)continue;
    const blanked=raw.slice();
    blanked.splice(span[0],span[1],(m?m[1]:"")+"___"+(m?m[3]:""));
    return {k:e.k,tr:e.tr,en:e.en,kind:"cloze",q:blanked.join(" "),
            c:core,alts:[fold(core)],hint:line[1],from:u.lv+" · "+u.tr};
  }
  /* No usable context: ask for the word itself. "ağabey (abi)" is two ways
     of saying one thing, so either is accepted and the shorter written form
     is what gets shown — asking the learner to type the whole entry,
     brackets and all, is not a question about Turkish. */
  const u=unit(e.unit);
  return {k:e.k,tr:e.tr,en:e.en,kind:"recall",q:e.en,c:vocabPrimary(e.tr),
          alts:vocabForms(e.tr),hint:"",from:(u?u.lv+" · "+u.tr:e.lv)};
}

/* --- the run --------------------------------------------------------- */
function startTekrar(){
  stopPlay();
  const q=repQueue().map(repItem);
  if(!q.length){V={view:"tekrar"};render();return;}
  TK={q:q,i:0,phase:"ask",typed:"",res:null,right:0};
  V={view:"tekrarrun"};window.scrollTo(0,0);
  touchDay();render();
}
function tkKeep(){
  const box=document.getElementById("tbox");
  if(box&&TK)TK.typed=box.value;
}
function tkCheck(){
  if(!TK)return;
  const it=TK.q[TK.i]; if(!it)return;
  tkKeep();
  /* Same matcher as the gap-fill drills — folded, and space-insensitive,
     so a learner without a Turkish keyboard is not punished — and any
     listed alternative counts, because "ad" and "isim" are both right. */
  const typed=fold(TK.typed), flat=typed.replace(/ /g,"");
  const good=(it.alts||[fold(it.c)]).some(function(a){
    return typed===a||flat===a.replace(/ /g,"");
  });
  TK.res=good;
  repGrade(it.k,good);
  if(good)TK.right++;
  TK.phase="check";render();
}
function tkSay(){
  const it=TK&&TK.q[TK.i];
  if(it)say(it.kind==="cloze"?it.q.replace("___",it.c):it.tr);
}
function tkNext(){
  if(!TK)return;
  TK.i++;TK.typed="";TK.res=null;TK.phase="ask";window.scrollTo(0,0);
  if(TK.i>=TK.q.length){TK.phase="end";}
  render();
}

/* --- screens ---------------------------------------------------------- */
function renderTekrar(){
  const short=repShort().length, due=repDue().length, b=repBands();
  const total=repBank().length;
  const bands=[["1","met once"],["2–3","thin"],["4–7","getting there"],
               ["8–20","durable"],["21+","embedded"]];
  let h=bar("Tekrar motoru","repetition · the words the course forgets",true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">The course teaches '+total+
   ' words and then mostly moves on. This counts how often each one actually turns up anywhere in the app, and drills whatever it will not bring back by itself — worst served first.</p>';
  /* The actionable number is the sitting, not the backlog: 495 due reads as
     a debt nobody will clear, and it is really "495 have not reached the
     target yet, ten of them now". */
  const now=Math.min(due,REP_SESSION);
  h+='<div class="stat"><div><b>'+now+'</b><span>şimdi</span></div>'+
     '<div><b>'+short+'</b><span>under '+REP_TARGET+'</span></div>'+
     '<div><b>'+(total-short)+'</b><span>at '+REP_TARGET+'+</span></div></div>';

  h+='<h2 class="sec">Çalış</h2><div class="card">'+
   '<p class="lead">'+now+' kelime · bu oturum</p>'+
   '<p class="tiny" style="margin:.1rem 0 .4rem">'+short+' of '+total+' are still short of '+REP_TARGET+' encounters. This works through them '+REP_SESSION+' at a time; it is a floor being raised, not a backlog to clear in one go.</p>'+
   '<p class="sub">Where the word appears in a passage, the line comes back with it blanked, and the answer is the form the sentence uses. Where it appears nowhere, the English comes first and you type the Turkish. Up to '+REP_SESSION+' in a sitting.</p>'+
   (due?'<button class="btn" onclick="startTekrar()">Başla</button>'
       :'<p class="tiny">Nothing due. The queue refills as boxes come round.</p>')+'</div>';

  h+='<h2 class="sec">Karşılaşma sayısı</h2><div class="card">';
  h+='<p class="sub" style="margin-bottom:.6rem">How many times each taught word is met — counting the app’s own material plus the drills below. Eight is roughly where a word starts to stay.</p>';
  const max=Math.max.apply(null,b)||1;
  bands.forEach(function(band,i){
    const pct=Math.round(100*b[i]/max);
    h+='<div style="display:flex;align-items:center;gap:.6rem;margin:.35rem 0">'+
      '<span class="tiny" style="width:3.2rem;text-align:right;flex:0 0 auto">'+band[0]+'</span>'+
      '<span style="flex:1;height:14px;background:var(--sunk);border-radius:99px;overflow:hidden">'+
      '<span style="display:block;height:100%;width:'+pct+'%;border-radius:99px;background:'+
      (i>=3?"var(--turk)":i===2?"var(--gold)":"var(--bole)")+'"></span></span>'+
      '<span class="tiny" style="width:5.5rem;flex:0 0 auto">'+b[i]+' · '+band[1]+'</span></div>';
  });
  h+='<p class="tiny" style="margin-top:.6rem">Red is a word the course mentions and abandons. The aim is to empty the top two rows into the bottom two.</p></div>';

  h+='<p class="foot">Encounters are counted by stem, so <i>kitaplar</i> counts for <i>kitap</i> but <i>kitabın</i> does not.<br>That undercounts, which is the safe direction for a floor.</p></div>';
  app().innerHTML=h;
}

function renderTekrarRun(){
  if(!TK){renderTekrar();return;}
  if(TK.phase==="end"){
    app().innerHTML=bar("Tekrar","Bitti",true)+'<div class="wrap"><div class="score">'+
      '<div class="big '+(TK.right*2>=TK.q.length?"pass":"fail")+'">'+TK.right+'/'+TK.q.length+'</div>'+
      '<p class="sub">kelime hatırlandı · recalled</p></div>'+
      '<div class="card"><p class="sub">'+repShort().length+' words are still under '+REP_TARGET+
      ' encounters. Every drill here counts as one, right or wrong — being asked is the encounter.</p>'+
      '<button class="btn" onclick="startTekrar()">Devam</button>'+
      '<button class="btn ghost" onclick="go(\'tekrar\')">Tekrar motoru</button></div></div>';
    return;
  }
  const it=TK.q[TK.i];
  let h=bar("Tekrar",(TK.i+1)+" / "+TK.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+TK.q.map(function(_,i){
    return '<i class="'+(i<TK.i?(TK.res===false&&i===TK.i-1?"no":"ok"):"")+'"></i>';
  }).join('')+'</div>';
  h+='<p class="qn">'+(it.kind==="cloze"?"Boşluğu doldur · the missing word":"Söyle ve yaz · recall it")+'</p>';

  if(it.kind==="cloze"){
    h+='<p class="q" style="font-family:\'Crimson Pro\',serif;font-size:1.3rem;font-weight:600">'+
      esc(it.q).replace(/___/g,'<span class="blank">____</span>')+'</p>';
    if(it.hint)h+='<p class="sub" style="margin:-.5rem 0 .9rem">'+esc(it.hint)+'</p>';
  }else{
    h+='<p class="q">'+esc(it.q)+'</p>';
  }

  if(TK.phase==="ask"){
    h+='<input class="inp" id="tbox" autocapitalize="off" autocomplete="off" autocorrect="off" '+
     'spellcheck="false" placeholder="yaz…" value="'+esc(TK.typed||"")+'">'+
     '<button class="btn" onclick="tkCheck()">Kontrol et</button>';
  }else{
    h+='<div class="card" style="text-align:center;padding:1.3rem 1rem">'+
     '<p style="font-family:\'Crimson Pro\',serif;font-size:1.5rem;margin:0">'+esc(it.c)+'</p>'+
     '<p class="sub" style="margin-top:.3rem">'+esc(it.tr+" · "+it.en)+'</p>'+
     '<button class="sbtn" style="margin-top:.4rem" onclick="tkSay()">'+IC.spk+' dinle</button></div>';
    h+='<div class="fb '+(TK.res?"ok":"no")+'"><b>'+(TK.res?"Doğru":"Yanlış")+'</b>'+
     (TK.res?"It comes back later and later from here."
            :"Wrong answers come back today. Being asked still counts as an encounter.")+'</div>';
    h+='<button class="btn" onclick="tkNext()">'+(TK.i+1>=TK.q.length?"Sonuç":"Devam")+'</button>';
  }
  h+='<p class="tiny" style="text-align:center;margin-top:.7rem">'+esc(it.from)+'</p></div>';
  app().innerHTML=h;
  const box=document.getElementById("tbox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")tkCheck();});
  }
}

/* ===================== bugün · the daily plan ===================== */
/* The app had six ways in and no opinion about which to use. This is the
   opinion, in the order the evidence supports: everything perishable
   first — reviews decay on a schedule, new material does not — and one
   new unit section last.

   Nothing is stored. A step is done when its own queue is empty, which is
   self-correcting: finish the work and the tick appears, come back
   tomorrow and it clears itself. The alternative, a per-day completion
   flag, would need its own state and could disagree with the queues. */
const PLAN_MIN=[15,30,20];           /* seconds per item: tekrar, dikte, üretim */
function planToday(){
  const rep=Math.min(repDue().length,REP_SESSION);
  const words=dueList().length;
  const dk=Math.min(dinleDue("d:"),DSESSION);
  const pr=Math.min(prodDue(sentenceBank()).length,SESSION);
  const rt=retellDue().length;
  /* "Yeni" absorbs the old resume card: mid-unit it carries you back to the
     exact section you were reading, and only falls back to the first
     unfinished unit when there is no bookmark. Two cards saying "open this
     unit" was one too many. */
  const at=S.place&&unit(S.place.u);
  /* Only resume a unit that is not finished. A bookmark survives
     completion, and following it regardless pinned the plan to a unit
     already ticked instead of moving on. */
  const resuming=!!at&&!isDone(at.id);
  const nx=resuming?at:nextUnit();
  const steps=[
    {k:"rep",  tr:"Tekrar",  en:"the words the course forgets", n:rep+words,
     mins:Math.round((rep*PLAN_MIN[0]+words*10)/60),
     go:rep?"startTekrar()":"startReview()"},
    {k:"dinle",tr:"Dinle",   en:"write down what you hear", n:dk,
     mins:Math.round(dk*PLAN_MIN[1]/60), go:"startDinle('d')"},
    {k:"prod", tr:"Söyle",   en:"say it before the model", n:pr,
     mins:Math.round(pr*PLAN_MIN[2]/60), go:"startProd('s')"},
    {k:"new",  tr:resuming?"Devam":"Yeni",
     en:nx?nx.lv+" · "+nx.tr+(resuming?" · "+secName(S.place.s):""):"every unit is done",
     n:nx?1:0, mins:nx?10:0,
     go:nx?"go('unit','"+nx.id+"','"+(resuming?S.place.s:"v")+"')":"home()"}
  ];
  if(rt)steps.splice(3,0,{k:"retell",tr:"Anlat",en:"tell it again from memory",n:rt,
                          mins:rt*3,go:"go('prod')"});
  const left=steps.filter(function(s){return s.n>0;});
  return {steps:steps,left:left,mins:steps.reduce(function(a,s){return a+(s.n?s.mins:0);},0)};
}
function planCard(){
  const p=planToday();
  let h='<h2 class="sec">Bugün</h2><div class="card">';
  if(!p.left.length){
    h+='<p class="lead">Bugünlük bitti</p>'+
     '<p class="sub">Every queue is empty and the course is finished. Anything you open now is revision by choice.</p></div>';
    return h;
  }
  h+='<p class="sub" style="margin:0 0 .5rem">In this order: reviews decay on a schedule, new material does not. About '+
   Math.max(1,p.mins)+' minute'+(p.mins===1?"":"s")+'.</p>';
  p.steps.forEach(function(s,i){
    const done=s.n===0;
    h+='<button class="unit" onclick="'+s.go+'">'+
      '<span class="tick '+(done?"done":(s===p.left[0]?"here":""))+'">'+(done?IC.check:(i+1))+'</span>'+
      '<span class="grow"><span class="unit-t">'+s.tr+(s.n>1?' · '+s.n:'')+'</span>'+
      '<span class="unit-s">'+esc(s.en)+(done?" · bitti":(s.mins?" · ~"+s.mins+" dk":""))+'</span></span>'+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  h+='<button class="btn" onclick="'+p.left[0].go+'">'+p.left[0].tr+' ile başla</button></div>';
  return h;
}
