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
/* Only the words of units actually met, worst-served first. Without the
   scope the engine sorted all 600 by how rarely the app mentions them,
   and the rarest words live in the advanced units — so a learner who had
   opened nothing was handed "abartı", "akıcı" and "anı" to recall. Worst
   served *among what you have met* is the useful ordering. */
function repBank(){
  return wordIndex().words.filter(function(e){return metWords(e.unit);})
    .sort(function(a,b){
      const d=repTotal(a)-repTotal(b);
      return d||(a.k<b.k?-1:1);     /* stable: same total, alphabetical */
    });
}
/* The whole course, for the hub to say how far the scope reaches. */
function repAll(){return wordIndex().words.length;}
function repShort(){                 /* still under the target */
  return repBank().filter(function(e){return repTotal(e)<REP_TARGET;});
}
function repDue(){
  return dueItems(S.rep,repShort(),NEW_DAY.rep);
}
/* Reviews first, oldest due first, then the worst-served words never
   drilled — the same shape as Üretim and Dinleme, over a different bank. */
function repQueue(){
  return repDue().slice(0,REP_SESSION);
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
  /* A word can occur in passages far above the learner's level — "hayır"
     turns up in a C1 text — and blanking it there hands a beginner a
     sentence they cannot read. Contexts are therefore restricted to units
     met, and the word's own unit is tried first, so the sentence is one
     that has actually been in front of them. No met context falls through
     to plain recall, which is always readable. */
  const where=e.where.filter(function(p){return metLines(p[0]);})
    .sort(function(x,y){
      const ax=x[0]===e.unit?0:1, ay=y[0]===e.unit?0:1;
      return ax-ay;
    });
  for(let a=0;a<where.length;a++){
    const p=where[a], u=unit(p[0]);
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
    return {k:e.k,u:e.unit,tr:e.tr,en:e.en,kind:"cloze",q:blanked.join(" "),
            c:core,alts:[fold(core)],hint:line[1],from:u.lv+" · "+u.tr};
  }
  /* No usable context: ask for the word itself. "ağabey (abi)" is two ways
     of saying one thing, so either is accepted and the shorter written form
     is what gets shown — asking the learner to type the whole entry,
     brackets and all, is not a question about Turkish. */
  const u=unit(e.unit);
  return {k:e.k,u:e.unit,tr:e.tr,en:e.en,kind:"recall",q:e.en,c:vocabPrimary(e.tr),
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
/* Is a typed word one of the answers? Pure, so the guided lesson marks a
   word exactly as Tekrar does. Same matcher as the gap-fill drills —
   folded, and space-insensitive, so a learner without a Turkish keyboard
   is not punished — and any listed alternative counts, because "ad" and
   "isim" are both right. A spoken spelling of the answer is the answer:
   gidicem is how gideceğim is said, and marking it wrong would teach a
   learner to distrust what they hear. Only ever toward the answer's own
   words. And Nasılsınız for Nasılsın, where the sentence does not say
   which you. */
function wordOk(typedRaw,alts,ctx,en){
  const typed=fold(typedRaw), flat=typed.replace(/ /g,"");
  const same=function(t,a){return t===a||t.replace(/ /g,"")===a.replace(/ /g,"");};
  if(alts.some(function(a){return typed===a||flat===a.replace(/ /g,"");}))return {ok:true,spoken:null,siz:null};
  let spoken=null, siz=null;
  alts.some(function(a){
    const sp=spokenToward(typedRaw,a);
    if(sp.used.length&&same(sp.text,a)){spoken=sp.used;return true;}
    return false;
  });
  if(spoken)return {ok:true,spoken:spoken,siz:null};
  alts.some(function(a){
    const sz=sizToward(typedRaw,a,ctx,en);
    if(sz.used.length&&same(sz.text,a)){siz=sz.used;return true;}
    return false;
  });
  return {ok:!!siz,spoken:null,siz:siz};
}
function tkCheck(){
  if(!TK)return;
  const it=TK.q[TK.i]; if(!it)return;
  tkKeep();
  const j=wordOk(TK.typed,it.alts||[fold(it.c)],it.kind==="cloze"?it.q:"",it.kind==="cloze"?it.hint:it.en);
  const good=j.ok;
  TK.spoken=j.spoken;TK.siz=j.siz;
  TK.res=good;
  /* Name the rule when one rule explains the miss; otherwise say nothing. */
  TK.diag=good?null:diagAny(TK.typed,it.c);
  repGrade(it.k,good);
  if(good)TK.right++;
  else errNote("r:"+it.k,{m:"r",q:it.q,c:it.c,a:TK.typed,w:TK.diag?TK.diag.t:"",to:it.u||""});
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
  const short=repShort().length, due=repDue().length;
  const total=repBank().length;
  let h=bar("Tekrar motoru","repetition · the words the course forgets",true,"kursun unuttuğu kelimeler")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('The course teaches '+total+
   ' words and then mostly moves on. This counts how often each one actually turns up anywhere in the app, and drills whatever it will not bring back by itself — worst served first.',
   'Kurs '+total+' kelime öğretir ve çoğunu bir daha anmaz. Bu bölüm her kelimenin uygulamada kaç kez geçtiğini sayar ve kendiliğinden geri gelmeyenleri çalıştırır; en az geçen önce gelir.')+'</p>';
  /* The actionable number is the sitting, not the backlog: 495 due reads as
     a debt nobody will clear, and it is really "495 have not reached the
     target yet, ten of them now". */
  const now=Math.min(due,REP_SESSION);
  h+='<div class="stat"><div><b>'+now+'</b><span>şimdi</span></div>'+
     '<div><b>'+short+'</b><span>'+tx('under '+REP_TARGET,REP_TARGET+' altı')+'</span></div>'+
     '<div><b>'+(total-short)+'</b><span>'+tx(REP_TARGET+' or more',REP_TARGET+' ve üstü')+'</span></div></div>';

  h+='<h2 class="sec">Çalış</h2><div class="card">'+
   '<p class="lead">'+now+' kelime · bu oturum</p>'+
   '<p class="tiny" style="margin:.1rem 0 .4rem">'+tx(short+' of '+total+' are still short of '+REP_TARGET+' encounters. This works through them '+REP_SESSION+' at a time, and brings in at most '+NEW_DAY.rep+' words it has not asked before each day, so a level test does not arrive as a hundred at once. It is a floor being raised, not a backlog to clear in one go.',
     total+' kelimeden '+short+' tanesi henüz '+REP_TARGET+' kez geçmedi. Bunlar '+REP_SESSION+' kelimelik oturumlarla çalışılır; her gün en fazla '+NEW_DAY.rep+' yeni kelime eklenir, böylece bir seviye sınavı yüz kelimeyi birden getirmez.')+'</p>'+
   '<p class="sub">'+tx('Where the word appears in a passage, the line comes back with it blanked, and the answer is the form the sentence uses. Where it appears nowhere, the English comes first and you type the Turkish. Up to '+REP_SESSION+' in a sitting.',
     'Kelime bir metinde geçiyorsa o satır kelime boş bırakılarak gelir; cümledeki biçimini yazarsın. Hiçbir yerde geçmiyorsa İngilizcesi gelir, sen Türkçesini yazarsın. Bir oturumda en fazla '+REP_SESSION+' kelime.')+'</p>'+
   (due?'<button class="btn" onclick="startTekrar()">Başla</button>'
       :'<p class="tiny">'+tx('Nothing due. The queue refills as boxes come round.','Şimdilik bekleyen yok. Sırası gelen kelimeler yeniden eklenir.')+'</p>')+'</div>';

  /* The distribution this engine exists to move is progress rather than a
     way in, so it is drawn on İlerleme (repChart there). */
  h+='<button class="btn ghost" onclick="go(\'ilerleme\')">İlerleme</button>';

  h+='<p class="foot">'+tx('Encounters are counted by stem, so <i>kitaplar</i> counts for <i>kitap</i> but <i>kitabın</i> does not.<br>That undercounts, which is the safe direction for a floor.',
    'Karşılaşmalar kökten sayılır: <i>kitaplar</i>, <i>kitap</i> için sayılır ama <i>kitabın</i> sayılmaz.<br>Bu yüzden sayı olduğundan az çıkar; güvenli olan da budur.')+'</p></div>';
  paint(h);
}

function renderTekrarRun(){
  if(!TK){renderTekrar();return;}
  if(TK.phase==="end"){
    endScreen({title:"Tekrar",n:TK.right,of:TK.q.length,label:"kelime hatırlandı · recalled",
               plan:true,again:repDue().length?"startTekrar()":""});
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
     (TK.res?tx("It comes back later and later from here.","Bundan sonra gittikçe daha geç gelecek.")
            :tx("Wrong answers come back today. Being asked still counts as an encounter.","Yanlışlar bugün yeniden gelir. Sorulmak yine de bir karşılaşma sayılır."))+
     (TK.res?spokenBox(TK.spoken,it.c)+sizBox(TK.siz,it.c):diagBox(TK.diag?[TK.diag]:[]))+altBox(tkAlts(it))+'</div>';
    h+='<button class="btn" onclick="tkNext()">'+(TK.i+1>=TK.q.length?"Sonuç":"Devam")+'</button>';
  }
  h+='<p class="tiny" style="text-align:center;margin-top:.7rem">'+esc(it.from)+'</p></div>';
  paint(h);
  const box=document.getElementById("tbox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")tkCheck();});
  }
}

/* ===================== dilbilgisi · grammar repetition ===================== */
/* The same hole the word engine filled, one level up. Each unit carries
   one grammar point, and `u.gram` renders in exactly one place — the
   unit's Dilbilgisi tab. Read it once and the course never asks for it
   again. Sixty points, met once each.

   What comes back here is the POINT, not a sentence: `S.gram` is keyed by
   unit id and the three or four worked examples rotate, so "the passive"
   returns on a widening schedule and a different sentence carries it each
   time. Keyed by sentence it would be memorised in a fortnight; keyed by
   pattern it stays a question about the grammar.

   And it is tested by production — English in, Turkish typed — because
   recognising what -DIK does is not the skill. The examples are already
   written in both languages and hand-checked, so the target is a vetted
   sentence rather than something generated.

   Scoped to points actually met, per CLAUDE.md: reading a B2 unit's word
   list does not put you in front of its grammar. */
const GRAM_SESSION=6;
function metGram(id){return isDone(id)||seenSec(id,"g");}
function gramBank(){
  return UNITS.filter(function(u){return metGram(u.id)&&u.gram&&u.gram.eg&&u.gram.eg.length;})
    .map(function(u){return {k:"y:"+u.id,u:u};});
}
function gramDue(){
  return dueItems(S.gram,gramBank(),NEW_DAY.gram);
}
function gramGrade(k,good){
  if(!S.gram)S.gram={};
  const had=S.gram[k];
  const r=bump(S.gram,k,function(b){return good?b+1:0;});
  r.n=((had&&had.n)||0)+1;           /* which example comes next */
  save();
}
/* The learner overrules the mark. It was just graded, so this replaces
   that grade rather than stacking another on top of it — from the box
   the point was on BEFORE the miss — and it must not advance the example
   counter a second time. */
function gramAccept(k,pre){
  if(!S.gram)S.gram={};
  const n=(S.gram[k]&&S.gram[k].n)||0;
  bump(S.gram,k,function(){return (pre<0?0:pre)+1;});
  S.gram[k].n=n;
  save();
}
/* Turkish word order is freer than these English prompts pin down:
   "I had him write the letter" is as truly "Ona mektubu yazdırdım" as
   "Mektubu ona yazdırdım", and 162 of the 181 targets would be failed by
   an order-sensitive judge for a single swap. So the verdict is the bag
   of words — every word the model has, nothing it does not — while the
   marked line stays the LCS, which is what names the word whose suffix
   went wrong. Reordering is reported, not punished. */
function gramJudge(model,typed){
  const r=dictScore(model,typed);
  const bag=function(s){return dictTokens(s).map(function(t){return t.f;}).sort().join(" ");};
  r.same=bag(model)===bag(typed);
  r.order=r.same&&!r.clean;
  return r;
}
function gramBox(k){const r=S.gram&&S.gram[k];return r?r.b:-1;}
function gramItem(it){
  const u=it.u, eg=u.gram.eg;
  const n=(S.gram&&S.gram[it.k]&&S.gram[it.k].n)||0;
  const e=eg[n%eg.length];
  return {k:it.k,id:u.id,en:e[1],c:e[0],t:u.gram.t,pt:u.gram.en,
          focus:u.focus,tbl:u.gram.tbl,lv:u.lv,from:u.lv+" · "+u.tr};
}
/* Weakest first, and "never drilled" is not a weakness — it sorts after
   everything that has been asked and missed. */
function gramWeak(){
  return gramBank().slice().sort(function(a,b){
    const x=gramBox(a.k), y=gramBox(b.k);
    if((x<0)!==(y<0))return x<0?1:-1;
    return x-y;
  });
}

/* --- the run --------------------------------------------------------- */
let GR=null;
function startGram(){
  stopPlay();
  const q=gramDue().slice(0,GRAM_SESSION).map(gramItem);
  if(!q.length){V={view:"gram"};render();return;}
  GR={q:q,i:0,phase:"ask",typed:"",res:null,right:0,hint:false,pre:-1,over:false};
  V={view:"gramrun"};window.scrollTo(0,0);
  touchDay();render();
}
function grKeep(){
  const box=document.getElementById("gbox");
  if(box&&GR)GR.typed=box.value;
}
function grHint(){grKeep();if(GR){GR.hint=true;render();}}
/* Is a typed sentence the model? Pure, so the guided lesson marks a
   grammar example exactly as Dilbilgisi tekrarı does: every word in any
   order, then a spoken spelling, the other you, and one subject pronoun
   more or fewer. */
function sentOk(model,typed,en){
  const J={res:gramJudge(model,typed),spoken:null,pron:null,siz:null};
  if(!J.res.same){
    const sp=spokenToward(typed,model);
    if(sp.used.length){
      const r2=gramJudge(model,sp.text);
      if(r2.same){J.res=r2;J.spoken=sp.used;}
    }
    /* The other you, where the sentence does not say which. */
    if(!J.res.same){
      const sz=sizToward(typed,model,"",en);
      if(sz.used.length){
        const r4=gramJudge(model,sz.text);
        if(r4.same){J.res=r4;J.siz=sz.used;}
      }
    }
    /* One subject pronoun more or fewer is still the sentence: the ending
       already says who. Marked on the line as optional, not as missing. */
    if(!J.res.same){
      const cands=[typed];
      if(sp.used.length)cands.push(sp.text);
      for(let i=0;i<cands.length;i++){
        const ps=pronounSlack(model,cands[i]);
        if(!ps)continue;
        const r3=gramJudge(model,cands[i]);
        r3.same=true;r3.order=false;
        r3.ops.forEach(function(o){if((o.t==="miss"||o.t==="extra")&&fold(o.w)===ps.w)o.t="may";});
        J.res=r3;J.pron=ps;
        if(i>0)J.spoken=sp.used;
        break;
      }
    }
  }
  return J;
}
function grCheck(){
  if(!GR)return;
  const it=GR.q[GR.i]; if(!it)return;
  grKeep();
  /* Every word, in any order — not dikte's four in five. The examples run
     four words at the median and the whole question is whether the form
     came out right, so forgiving one word in four would forgive the
     point. The marked line still names which word went wrong, which is
     the part worth reading. */
  GR.pre=gramBox(it.k);
  GR.over=false;
  const j=sentOk(it.c,GR.typed,it.en);
  GR.res=j.res;GR.spoken=j.spoken;GR.pron=j.pron;GR.siz=j.siz;
  GR.diag=GR.res.same?[]:diagnoseLine(it.c,GR.typed,2);
  gramGrade(it.k,GR.res.same);
  if(GR.res.same)GR.right++;
  else errNote(it.k,{m:"y",q:it.t+" · "+it.en,c:it.c,a:GR.typed,
                     w:it.focus+(GR.diag.length?" — "+GR.diag[0].t:""),to:it.id});
  GR.phase="check";render();
}
/* A word-level judge can mark words; it cannot mark Turkish. Where the
   prompt leaves the choice open — a synonym, a tense English does not
   distinguish, an object the English only implies — the learner knows
   whether what they wrote was right, and everything else in Üretim is
   self-graded for exactly that reason. This is the escape hatch, and it
   is deliberately one tap rather than the default. */
function grAccept(){
  if(!GR||GR.phase!=="check"||GR.res.same||GR.over)return;
  const it=GR.q[GR.i];
  gramAccept(it.k,GR.pre);
  /* Overruled is not missed: the entry the mark just wrote comes back out
     again, or the book would record a mistake the learner did not make. */
  errForget2(it.k);
  GR.over=true;GR.right++;render();
}
function grSay(){const it=GR&&GR.q[GR.i];if(it)say(it.c);}
function grNext(){
  if(!GR)return;
  GR.i++;GR.typed="";GR.res=null;GR.hint=false;GR.over=false;GR.pre=-1;GR.phase="ask";window.scrollTo(0,0);
  if(GR.i>=GR.q.length)GR.phase="end";
  render();
}

/* --- screens ---------------------------------------------------------- */
function renderGram(){
  const bank=gramBank(), due=gramDue().length, now=Math.min(due,GRAM_SESSION);
  const firm=bank.filter(function(it){return gramBox(it.k)>=4;}).length;
  let h=bar("Dilbilgisi tekrarı","grammar · produce it, do not recognise it",true,"tanıma değil, kur")+'<div class="wrap">';
  if(!bank.length){
    h+='<div class="card"><p class="lead">Henüz dilbilgisi yok</p>'+
     '<p class="sub">'+tx('This drills the grammar points you have read. Open a unit’s Dilbilgisi tab and its point starts coming back here.',
       'Burada okuduğun dilbilgisi konuları çalışılır. Bir ünitenin Dilbilgisi sekmesini açınca o konu buraya gelmeye başlar.')+'</p>'+
     '<button class="btn" onclick="home()">Bugüne dön</button></div></div>';
    paint(h);return;
  }
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('The course explains each grammar point once, in one tab, and then moves on. '+
   'This brings the point back on a widening schedule and asks you to <i>build</i> a sentence with it from English — '+
   'the examples rotate, so what is being tested is the pattern rather than one sentence.',
   'Kurs her dilbilgisi konusunu bir kez, tek bir sekmede anlatır. Bu bölüm konuyu gittikçe açılan aralıklarla geri getirir ve İngilizceden bir cümle <i>kurmanı</i> ister. '+
   'Örnekler değişir; sınanan tek bir cümle değil, kalıbın kendisidir.')+'</p>';
  h+='<div class="stat"><div><b>'+now+'</b><span>şimdi</span></div>'+
     '<div><b>'+bank.length+'</b><span>'+tx('read','okunan')+'</span></div>'+
     '<div><b>'+firm+'</b><span>'+tx('holding','oturmuş')+'</span></div></div>';

  h+='<h2 class="sec">Çalış</h2><div class="card">'+
   '<p class="lead">'+now+' konu · bu oturum</p>'+
   '<p class="sub">'+tx('English in, Turkish typed. Every word has to be there — these sentences are short, and the form is the whole question — but the order is yours, because Turkish allows what the English prompt does not pin down. '+
   'Diacritics are forgiven, so ı ş ğ ç ö ü are optional, and where you produced a different correct sentence you can say so. The point and its table are there if you want them before answering.',
   'İngilizcesi gelir, sen Türkçesini yazarsın. Her kelime olmalı, çünkü sorulan şey biçimin kendisi; ama sıra sana kalmış, Türkçe buna izin verir. '+
   'ı ş ğ ç ö ü yazmak zorunlu değil. Başka doğru bir cümle kurduysan bunu söyleyebilirsin. İstersen cevaptan önce konuya ve tablosuna bakabilirsin.')+'</p>'+
   (due?'<button class="btn" onclick="startGram()">Başla</button>'
       :'<p class="tiny">'+tx('Nothing due. Points come back as their boxes come round.','Şimdilik bekleyen yok. Konular sırası gelince geri gelir.')+'</p>')+'</div>';

  const weak=gramWeak();
  h+='<h2 class="sec">Konular</h2><div class="card">'+
   '<p class="sub" style="margin-bottom:.6rem">'+tx('Weakest first. A point missed drops to today; a point produced correctly moves out one box.',
     'En zayıf olan önce. Yanlış yapılan konu bugüne döner; doğru kurulan bir kutu ileri gider.')+'</p>';
  weak.slice(0,10).forEach(function(it){
    const b=gramBox(it.k);
    h+='<button class="unit" onclick="go(\'unit\',\''+it.u.id+'\',\'g\')">'+
      '<span class="grow"><span class="unit-t">'+esc(it.u.gram.t)+'</span>'+
      '<span class="unit-s">'+it.u.lv+' · '+esc(it.u.gram.en)+' · '+
      (b<0?"hiç sorulmadı · not yet asked":"kutu "+b+" · box "+b)+'</span></span>'+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  if(weak.length>10)h+='<p class="tiny" style="margin-top:.5rem">'+tx('and '+(weak.length-10)+' more, further out.','ve daha ileride '+(weak.length-10)+' konu daha.')+'</p>';
  h+='</div>';
  h+='<p class="foot">'+tx('The target sentences are the units’ own worked examples.<br>Nothing here is generated, so nothing here is approximate.',
    'Hedef cümleler ünitelerin kendi örnekleridir.<br>Burada hiçbir şey üretilmez, yani hiçbir şey yaklaşık değildir.')+'</p></div>';
  paint(h);
}

function renderGramRun(){
  if(!GR){renderGram();return;}
  if(GR.phase==="end"){
    endScreen({title:"Dilbilgisi",n:GR.right,of:GR.q.length,label:"doğru üretildi · produced",
               plan:true,again:gramDue().length?"startGram()":""});
    return;
  }
  const it=GR.q[GR.i];
  let h=bar("Dilbilgisi",(GR.i+1)+" / "+GR.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+GR.q.map(function(_,i){
    return '<i class="'+(i<GR.i?(GR.res&&!GR.res.same&&!GR.over&&i===GR.i-1?"no":"ok"):"")+'"></i>';
  }).join('')+'</div>';
  /* The point is named before the question, always. This is not a memory
     test about which chapter a suffix came from — it is "use this, now". */
  h+='<p class="qn">'+esc(it.t)+' · '+esc(it.pt)+'</p>';
  h+='<p class="q">'+esc(it.en)+'</p>';

  if(GR.phase==="ask"){
    h+='<input class="inp" id="gbox" autocapitalize="off" autocomplete="off" autocorrect="off" '+
     'spellcheck="false" placeholder="Türkçe yaz…" value="'+esc(GR.typed||"")+'">'+
     '<button class="btn" onclick="grCheck()">Kontrol et</button>';
    if(GR.hint&&it.tbl){
      h+='<div class="card gram"><p class="tiny" style="margin:0 0 .4rem">'+esc(it.focus)+'</p><table class="table">';
      it.tbl.forEach(function(r){h+='<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>';});
      h+='</table></div>';
    }else if(it.tbl){
      h+='<button class="btn ghost" onclick="grHint()">İpucu · show the pattern</button>';
    }
  }else{
    const r=GR.res;
    h+='<div class="card"><p class="dline">'+r.ops.map(function(o){
      return '<span class="dw '+(o.t==="ok"?"":o.t)+'">'+esc(o.w)+'</span>';
    }).join(" ")+'</p>'+
     '<p class="sub" style="margin-top:.6rem">'+esc(it.en)+'</p>'+
     '<button class="sbtn" style="margin-top:.4rem" onclick="grSay()">'+IC.spk+' dinle</button></div>';
    const won=r.same||GR.over;
    h+='<div class="fb '+(won?"ok":"no")+'"><b>'+
     (GR.over&&!r.same?"Kabul edildi":r.same?"Doğru":r.hit+" / "+r.of+" kelime")+'</b>'+
     (GR.over&&!r.same?tx("Taken as right. The point moves out a box.","Doğru kabul edildi. Konu bir kutu ileri gider.")
      :r.same?(r.order?tx("Same words, different order — Turkish allows it, and the model above is the usual one. It comes back later and later from here.",
                          "Aynı kelimeler, başka bir sırayla. Türkçe buna izin verir; yukarıdaki sıra en yaygın olanı. Bundan sonra gittikçe daha geç gelecek.")
                      :tx("It comes back later and later from here.","Bundan sonra gittikçe daha geç gelecek."))
             :tx((r.extra?"Struck-through words are not in the sentence. ":"")+"Red is what the model has and you did not. This point comes back today.",
                 (r.extra?"Üstü çizili kelimeler cümlede yok. ":"")+"Kırmızı olanlar örnekte var, sende yok. Bu konu bugün yeniden gelecek."))+
     (won?(r.same?spokenBox(GR.spoken,it.c)+sizBox(GR.siz,it.c):""):diagBox(GR.diag))+altBox(grAlts(it),GR.pron&&r.same?PRON_NOTE:"")+'</div>';
    if(!won)h+='<button class="btn ghost" onclick="grAccept()">Benimki de doğru · mine was right too</button>';
    h+='<button class="btn ghost" onclick="go(\'unit\',\''+it.id+'\',\'g\')">Konuyu aç · read the point again</button>';
    h+='<button class="btn" onclick="grNext()">'+(GR.i+1>=GR.q.length?"Sonuç":"Devam")+'</button>';
  }
  h+='<p class="tiny" style="text-align:center;margin-top:.7rem">'+esc(it.from)+'</p></div>';
  paint(h);
  const box=document.getElementById("gbox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")grCheck();});
  }
}

/* The rule behind a miss, when diagnose() found one. Inside the feedback
   card, so it reads as part of the answer rather than a new message. */
/* The other ways to say it. Whatever the learner typed — short or long,
   spoken or written, one listed word or its alternative — the others are
   shown, and never the form they typed themselves. The spoken form is
   offered up to B2 only: C1 and C2 teach the written register on purpose,
   and "bi" in an academic sentence would be a wrong thing to model. */
const PRON_NOTE="The pronoun is optional: the ending already says who, so the sentence is right with it or without it. Leaving it out is the everyday form; putting it in stresses it.";
function spokenLv(lv){return ["A1","A2","B1","B2"].indexOf(lv)>-1;}
/* Collects alternatives, skipping any already on screen. */
function altCollector(shown){
  const lines=[], seen={};
  shown.forEach(function(x){seen[fold(x||"")]=1;});
  return {lines:lines,add:function(label,form){
    if(!form)return;
    const f=fold(form); if(!f||seen[f])return;
    seen[f]=1; lines.push([label,form]);
  }};
}
function tkAlts(it){
  const A=altCollector([TK.typed,it.c]);          /* the card already shows it.c */
  if(it.kind==="recall")
    String(it.tr).replace(/\(([^)]*)\)/g,"/$1").split("/").forEach(function(x){A.add("ayrıca · also right",x.trim());});
  const u=unit(it.u);
  if(u&&spokenLv(u.lv)&&!TK.spoken)A.add("konuşurken · in speech",spokenOf(it.c));
  return A.lines;
}
function grAlts(it){
  const A=altCollector([GR.typed]);
  if(GR.pron)A.add(GR.pron.k==="drop"?"tam hâli · the full form":"kısası · the everyday form",it.c);
  else A.add("kısası · shorter, without the pronoun",shortOf(it.c));
  if(spokenLv(it.lv)&&!GR.spoken)A.add("konuşurken · in speech",spokenOf(it.c));
  return A.lines;
}
function altBox(lines,note){
  if(!lines||!lines.length)return note?'<div class="diag"><p>'+esc(note)+'</p></div>':"";
  return '<div class="diag"><b>Başka türlü · other ways to say it</b>'+
    (note?'<p>'+esc(note)+'</p>':'')+
    lines.map(function(l){return '<p><i>'+esc(l[0])+'</i><br><span class="af">'+esc(l[1])+'</span></p>';}).join("")+'</div>';
}
/* A right answer given in its spoken spelling: say so, and show the
   written form, because that is the one the learner will read. */
function spokenBox(used,written){
  if(!used||!used.length)return "";
  return '<div class="diag"><b>Konuşma dili · spoken form</b><p>'+
    used.map(function(w){return '“'+esc(w)+'”';}).join(", ")+
    (used.length===1?' is':' are')+' how it is said, so it counts. Written Turkish spells it “'+
    esc(String(written).replace(/[.!?]+$/,""))+'”, and that is the form you will read.</p></div>';
}
function sizBox(used,written){
  if(!used||!used.length)return "";
  return '<div class="diag"><b>Sen · siz</b><p>'+
    used.map(function(w){return '“'+esc(w)+'”';}).join(", ")+
    ' is the other “you”: siz is polite, or more than one person, and sen is one person you know well. Nothing here says which is meant, so it counts. The answer written here was “'+
    esc(String(written).replace(/[.!?]+$/,""))+'”.</p></div>';
}
function diagBox(ds){
  if(!ds||!ds.length)return "";
  return '<div class="diag"><b>Neden? · why</b>'+ds.map(function(d){return '<p>'+esc(d.t)+'</p>';}).join("")+'</div>';
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
const PLAN_MIN=[15,30,20,25];        /* seconds per item: tekrar, dikte, üretim, dilbilgisi */
function planToday(){
  const rep=Math.min(repDue().length,REP_SESSION);
  const words=dueList().length;
  const gr=Math.min(gramDue().length,GRAM_SESSION);
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
  /* Today's new unit is done: the step stays, ticked, naming tomorrow's. */
  const capped=!resuming&&!!nx&&unitsToday()>=UNIT_DAY;
  /* Before any unit is opened, a complete beginner is pointed at the
     intro lessons first. Still one instruction on day one. */
  const intro=baslaPlan();
  /* A step with a zero count means one of two different things, and showing
     a completion tick for both is a lie: either today's queue is cleared,
     or the queue does not exist yet because nothing has been met. The
     second kind is left out of the plan altogether — a beginner should see
     one instruction, not three ticked rows for work they have never done. */
  const steps=[
    {k:"rep",  tr:"Tekrar",  en:"the words the course forgets", tt:"kursun unuttuğu kelimeler", n:rep+words,
     avail:repBank().length>0||S.star.length>0,
     mins:Math.round((rep*PLAN_MIN[0]+words*10)/60),
     go:rep?"startTekrar()":"startReview()"},
    /* Grammar sits second: it decays like the words do, and unlike Dinle
       and Söyle it is the one step that asks for a form rather than a
       sentence already met. */
    {k:"gram", tr:"Dilbilgisi",en:"build a sentence with the pattern", tt:"kalıpla bir cümle kur", n:gr,
     avail:gramBank().length>0,
     mins:Math.round(gr*PLAN_MIN[3]/60), go:"startGram()"},
    {k:"dinle",tr:"Dinle",   en:"write down what you hear", tt:"duyduğunu yaz", n:dk,
     avail:listenBank("d:").length>0,
     mins:Math.round(dk*PLAN_MIN[1]/60), go:"startDinle('d')"},
    {k:"prod", tr:"Söyle",   en:"say it before the model", tt:"örnekten önce sen söyle", n:pr,
     avail:sentenceBank().length>0,
     mins:Math.round(pr*PLAN_MIN[2]/60), go:"startProd('s')"},
    intro?
    {k:"new",  tr:"Giriş", en:"before unit one · "+intro.en, tt:"birinci üniteden önce · "+intro.tr,
     n:1, mins:8, avail:true, go:"go('basla','"+intro.id+"')"}:
    capped?
    {k:"new",  tr:"Yarın", en:"tomorrow: "+nx.lv+" · "+nx.tr, tt:"yarın: "+nx.lv+" · "+nx.tr,
     n:0, mins:0, avail:true, go:"go('unit','"+nx.id+"','v')"}:
    {k:"new",  tr:resuming?"Devam":"Yeni",
     en:nx?nx.lv+" · "+nx.tr+(resuming?" · "+secName(S.place.s):""):"every unit is done",
     tt:nx?nx.lv+" · "+nx.tr+(resuming?" · "+secName(S.place.s).split(" · ")[0]:""):"bütün üniteler bitti",
     n:nx?1:0, mins:nx?10:0, avail:!!nx,
     go:nx?"go('unit','"+nx.id+"','"+(resuming?S.place.s:"v")+"')":"home()"}
  ];
  if(rt)steps.splice(steps.length-1,0,{k:"retell",tr:"Anlat",en:"tell it again from memory",tt:"aklından yeniden anlat",n:rt,
                          avail:true,mins:rt*3,go:"startRetell('"+retellDue()[0].id+"')"});
  /* The commonest words the units never teach. New material, so after
     every review and before the unit — and only once a unit is finished,
     or day one would be two instructions. */
  if(sikAvail()){
    const sn=sikLeft();
    steps.splice(steps.length-1,0,{k:"sik",tr:"Kelime",en:"common words the units never teach",tt:"ünitelerin öğretmediği sık kelimeler",n:sn,
                                   avail:true,mins:Math.max(1,Math.round(sn*30/60)),go:"go('sik')"});
  }
  const shown=steps.filter(function(s){return s.avail;});
  const left=shown.filter(function(s){return s.n>0;});
  return {steps:shown,left:left,all:steps,tomorrow:capped?nx:null,
          mins:shown.reduce(function(a,s){return a+(s.n?s.mins:0);},0)};
}
/* Bugün on the landing page is one button. It used to be a heading, a
   folded summary ("6 adım · steps left · ~27 dk"), a paragraph on why the
   steps come in this order, the step list when unfolded, and then the
   button; the learner found it busy, and none of it is needed to start.
   The button names the step it opens, and each sitting ends on the next
   one (endScreen below), so the plan is walked without being read. The
   list, with its ticks, is on İlerleme for whoever wants to see it. */
function planCard(){
  const p=planToday(), s=p.left[0];
  let h='<h2 class="sec">Bugün</h2>';
  if(!s){
    const t=p.tomorrow;
    return h+'<div class="today done"><span class="today-t">Bugünlük bitti<span class="gl">done for today</span></span>'+
      '<span class="today-s">'+(t?tx('Tomorrow: '+esc(t.lv+' · '+t.tr)+'. One new unit a day gives the reviews time to work.',
                                      'Yarın: '+esc(t.lv+' · '+t.tr)+'. Günde bir yeni ünite, tekrarların işlemesine zaman tanır.')
                            :tx('Every unit is done and nothing is due.','Bütün üniteler bitti, bekleyen bir şey yok.'))+'</span></div>'+
      /* The pace is the plan's, not a lock. */
      (t?'<button class="homelink" onclick="go(\'unit\',\''+t.id+'\',\'v\')">Yine de devam et<span class="gl">carry on anyway</span></button>':'');
  }
  return h+'<button class="today" onclick="'+s.go+'">'+
    '<span class="today-t">Başla<span class="gl">start</span></span>'+
    '<span class="today-s">'+esc(s.tr)+' · '+(s.tt&&s.tt!==s.en?tx(esc(s.en),esc(s.tt)):esc(s.en))+'</span>'+
    '<span class="chev">'+IC.chev+'</span></button>';
}
/* The whole plan as rows, ticked as each queue empties; drawn on İlerleme. */
function planRows(p){
  let h='';
  p.steps.forEach(function(s,i){
    const done=s.n===0;
    h+='<button class="unit" onclick="'+s.go+'">'+
      '<span class="tick '+(done?"done":(s===p.left[0]?"here":""))+'">'+(done?IC.check:(i+1))+'</span>'+
      '<span class="grow"><span class="unit-t">'+s.tr+(s.n>1?' · '+s.n:'')+'</span>'+
      '<span class="unit-s">'+(s.tt&&s.tt!==s.en?tx(esc(s.en),esc(s.tt)):esc(s.en))+(done?(s===p.all[p.all.length-1]&&p.tomorrow?"":" · bitti"):(s.mins?" · ~"+s.mins+" dk":""))+'</span></span>'+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  return h;
}

/* ===================== bitti · the end of a sitting ===================== */
/* A sitting ends on its score and the way on, and nothing else. It used
   to end on the state of the whole mode as well — how many words were
   still under eight encounters, how many lines were left in the set —
   and on two buttons, one restarting the same mode and one opening its
   hub. So a learner working through Bugün finished Tekrar, read a
   paragraph they had read the day before, and then had to go home to
   find out what came next. The paragraph lives on İlerleme now, and the
   main button here is the plan's next step: the first one with work
   left, which is the same step again only while it still has some.

   planToday() is read at the moment the screen is drawn, after the
   sitting's grades are saved, so the step just finished has already
   ticked itself off or not. Nothing is stored. */
function planNext(){
  const nx=planToday().left[0];
  const tm=planToday().tomorrow;
  if(!nx)return '<div class="card"><p class="lead">Bugünlük bitti</p><p class="sub">'+
    tx('Everything in today’s plan is done. Anything more is extra.','Bugünün planındaki her şey bitti. Bundan sonrası fazladan.')+
    (tm?' '+tx('Tomorrow: '+esc(tm.lv+' · '+tm.tr)+'.','Yarın: '+esc(tm.lv+' · '+tm.tr)+'.'):'')+'</p>'+
    '<button class="btn" onclick="home()">Ana sayfa</button></div>';
  return '<button class="btn" onclick="'+nx.go+'">Devam</button>'+
    '<p class="tiny next-step">'+tx('Next: '+esc(nx.tr)+' · '+esc(nx.en),'Sıradaki: '+esc(nx.tr)+' · '+esc(nx.tt||nx.en))+'</p>';
}
/* o: {title, n, of, label, plan, again, hub, hubName}. `plan` is true for
   the modes Bugün sends a learner to; the rest are reached from Araçlar,
   so their first button is another sitting and the second their hub.
   `again` is left out when the mode has nothing more due, and in a plan
   mode it is also left out when it is the plan's own next step, or the
   screen would offer the same thing twice. */
function endScreen(o){
  const nx=planToday().left[0];
  let h=bar(o.title,"Bitti",true)+'<div class="wrap"><div class="score">'+
    '<div class="big '+(o.of&&o.n*2<o.of?"fail":"pass")+'">'+o.n+(o.of?'/'+o.of:'')+'</div>'+
    '<p class="sub">'+o.label+'</p></div>';
  if(o.plan){
    h+=planNext();
    if(o.again&&!(nx&&nx.go===o.again))h+='<button class="btn ghost" onclick="'+o.again+'">Bir oturum daha</button>';
  }else{
    if(o.again)h+='<button class="btn" onclick="'+o.again+'">Bir daha</button>';
    if(o.hub)h+='<button class="btn'+(o.again?' ghost':'')+'" onclick="'+o.hub+'">'+o.hubName+'</button>';
  }
  paint(h+'</div>');
}

