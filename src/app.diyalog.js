/* Diyalog: a conversation that branches, and the repair kit that keeps it
   alive when you did not catch something. */

/* ===================== diyalog · branching dialogue ===================== */
/* Every other mode in this app is one exchange with a known answer. A real
   conversation is not: the next turn depends on what you said, and
   sometimes you simply do not catch it.

   What ends a conversation for a learner is almost never the missing word.
   It is the freeze — the two seconds of nothing, after which the other
   person switches to English. The cure is a reflex, and the phrases for it
   have been in the chunk bank all along (the `tamir` group), drilled in
   Üretim as isolated lines. Nothing has ever put a learner somewhere they
   NEEDED one.

   So the thesis, and everything else follows from it:

     **A repair is not a mistake.** Every other mode marks you wrong for
     not knowing. This one marks you wrong only for stopping. Asking
     someone to repeat themselves is what a competent speaker does all day;
     a mode that penalised it would train exactly the freeze it exists to
     cure.

   The score is therefore **completion, not correctness** — did you finish
   the errand, and how much repair did it take. Finishing with four repairs
   is a pass. Abandoning because one word got away is the only failure.

   Second decision, following from the first: **the other person is never
   shown as text.** Read it and this is a reading exercise with extra
   steps. The line is spoken; the screen holds only what you may do.

   Third: the slots are generated per run. The skeleton repeats, so without
   them the fourth sitting would be recitation — but the price is a
   different price every time, and there is no way to answer it but to
   parse it. That is why Sayılar had to come first: its parsers mark the
   numbers here, and a number is the one thing in a conversation a machine
   can honestly judge. */

/* The repair kit, by what each move DOES to the other person. These are
   chunk-bank phrases, not new material — validate.js checks every one is
   still in CHUNKS, so editing the bank cannot silently strand them. */
const DIA_REPAIR=[
 {tr:"bir daha söyler misiniz", en:"could you say that again", lv:1, rate:0.85},
 {tr:"daha yavaş lütfen",       en:"more slowly, please",     lv:1, rate:0.65},
 {tr:"affedersiniz, anlamadım", en:"sorry, I didn't understand", lv:2, rate:0.8}
];
const DIA_RATE=1;                    /* the other person talks at full speed */

/* --- slots ------------------------------------------------------------- */
/* Resolved once per run. A pick carries its own inflected forms rather
   than deriving them: "Bursa'ya" and "İzmir'e" differ by vowel harmony the
   engine could do, but a proper name is exactly the place a generated
   ending goes wrong in public, so the data lists what is not derivable —
   the same rule lex.js follows. */
function diaVars(sc){
  const V={};
  Object.keys(sc.vars||{}).forEach(function(k){
    const spec=sc.vars[k];
    if(spec.pick){
      const o=pick(spec.pick);
      V[k]=Object.assign({},o,{tr:o.t,val:o.t,kind:"söz"});
    }else if(spec.price){
      const l=numRand(spec.price[0],spec.price[1]), ku=pick([0,0,0,50]);
      V[k]={t:String(l),tr:priceText(l,ku),val:[l,ku],kind:"fiyat",
            show:l+(ku?","+ku:"")+" TL"};
    }else if(spec.time){
      const h=numRand(1,12), m=pick([0,5,10,15,20,30,40,45,50]);
      V[k]={t:h+":"+String(m).padStart(2,"0"),tr:timeText(h,m),val:[h,m],
            kind:"saat",show:h+":"+String(m).padStart(2,"0")};
    }else if(spec.num){
      const n=numRand(spec.num[0],spec.num[1]);
      V[k]={t:String(n),tr:numText(n),val:n,kind:"sayi",show:String(n)};
    }
  });
  /* Derived slots come last, so the thing they double already exists. */
  Object.keys(sc.vars||{}).forEach(function(k){
    const spec=sc.vars[k];
    if(!spec.x2)return;
    const b=V[spec.x2]; if(!b)return;
    const l=b.val[0]*2, ku=b.val[1];
    V[k]={t:String(l),tr:priceText(l,ku),val:[l,ku],kind:"fiyat",
          show:l+(ku?","+ku:"")+" TL"};
  });
  return V;
}
/* A slot at the start of a sentence has to be capitalised, and Turkish
   capitalises i as İ — "üç yüz otuz sekiz lira" is a price the app got
   right and then printed wrong. Applies after substitution, because until
   then there is no letter there to capitalise. */
function capSentences(s){
  return String(s).replace(/(^|[.!?]\s+|…\s*)([a-zçğıöşü])/g,
    function(m,pre,c){return pre+capTR(c);});
}
/* {name} is the slot spoken, {name.dat} one of its listed forms. In an
   English label a slot renders its OWN English — "how much is the
   soğan?" was what leaving that out produced. */
function diaText(s,V,field){
  const out=String(s==null?"":s).replace(/\{([a-z0-9]+)(?:\.([a-z0-9]+))?\}/gi,
    function(m,k,f){
      const v=V[k];
      if(!v)return m;
      if(f)return v[f]!==undefined?v[f]:v.t;
      if(field==="en")return v.e!==undefined?v.e:v.t;
      return v.tr;
    });
  return field==="en"?out:capSentences(out);
}
function diaScenario(id){return DIYALOG.find(function(s){return s.id===id;});}

/* --- the record -------------------------------------------------------- */
/* Keyed by scenario, which is why the ids are permanent. `n` counts
   completions, and that is deliberately ALL it counts.

   The first version also kept the fewest repairs ever taken, as a record
   to beat. That quietly inverted the whole mode: a learner who guessed at
   a price and got it wrong finished with nought repairs and a better
   record than one who asked twice and got it right. A mode whose thesis is
   "a repair is not a mistake" must not put a repair counter on the
   trophy — so the repairs are reported for the run you just had, as
   information, and nothing keeps score of them. */
function diaGrade(id,done){
  if(!S.dia)S.dia={};
  const had=S.dia[id];
  const r=bump(S.dia,id,function(b){return done?b+1:0;});
  r.n=((had&&had.n)||0)+(done?1:0);
  save();
}
function diaDue(){
  return DIYALOG.filter(function(s){return isDue(S.dia,s.id);});
}

/* --- the run ----------------------------------------------------------- */
/* DG holds a conversation and, like VOICE and PR, survives a re-render. */
let DG=null;
function startDia(id){
  stopPlay();
  const sc=diaScenario(id);
  if(!sc||!ttsOK()){V={view:"diyalog"};render();return;}
  DG={id:id,sc:sc,V:diaVars(sc),at:sc.start,phase:"hear",lv:0,rep:0,
      turns:0,typed:"",res:null,said:null,nums:0,numOk:0,log:[]};
  /* The opening line goes in the log here; every later one goes in as the
     conversation moves to it. Without this the transcript began at the
     second thing they said. */
  DG.log.push({who:"them",tr:diaText(sc.beats[sc.start].say,DG.V)});
  V={view:"diyalogrun"};window.scrollTo(0,0);
  touchDay();render();diaSay();
}
function diaBeat(){return DG?DG.sc.beats[DG.at]:null;}
/* What is said now: the plain line, or — once a repair has been asked for
   — the slower one, or the plainer rephrase. */
function diaLine(){
  const b=diaBeat(); if(!b)return "";
  const s=DG.lv>=2&&b.easy?b.easy:(DG.lv>=1&&b.slow?b.slow:b.say);
  return diaText(s,DG.V);
}
function diaSay(rate){
  if(!DG)return;
  const l=diaLine();
  if(l)say(l,rate||DIA_RATE);
}
/* A repair costs a turn and nothing else. It is counted so the learner can
   watch the count fall, never so it can be held against them. */
function diaRepair(i){
  if(!DG)return;
  const r=DIA_REPAIR[i]; if(!r)return;
  DG.rep++;DG.turns++;
  DG.lv=Math.max(DG.lv,r.lv);
  DG.log.push({who:"me",tr:r.tr,rep:true});
  render();
  say(diaLine(),r.rate);
}
function diaKeep(){
  const box=document.getElementById("dgbox");
  if(box&&DG)DG.typed=box.value;
}
/* Choosing a move: you have already said it out loud, and now the model is
   shown and spoken — the Üretim shape, one beat at a time. */
function diaPick(i){
  if(!DG)return;
  const b=diaBeat(); if(!b||!b.opts)return;
  const o=b.opts[i]; if(!o)return;
  DG.said=o;DG.phase="model";DG.turns++;
  DG.log.push({who:"me",tr:diaText(o.tr,DG.V)});
  render();
  say(diaText(o.tr,DG.V));
}
/* A number is the one thing here a machine can mark, so it is marked — by
   Sayılar's own parsers, and recorded against Sayılar's own key, because a
   price missed at a stall and a price missed at a desk are one weakness. */
function diaCheck(){
  if(!DG)return;
  const b=diaBeat(); if(!b||!b.want)return;
  diaKeep();
  const v=DG.V[b.want]; if(!v)return;
  const ok=numJudge({kind:v.kind,val:v.val},DG.typed);
  DG.res=ok;DG.phase="model";DG.turns++;DG.nums++;if(ok)DG.numOk++;
  DG.log.push({who:"me",tr:DG.typed||"—",num:true,ok:ok});
  if(!ok)errNote("n:duy:"+(v.kind==="sayi"?"3":v.kind),
                 {m:"n",q:v.tr,c:v.show||v.t,a:DG.typed,w:"diyalog · "+DG.sc.tr});
  render();
}
/* The conversation carries on whether or not the number was right. In a
   shop you would hand over the wrong note and be corrected; you would not
   walk out. */
function diaNext(){
  if(!DG)return;
  const b=diaBeat(); if(!b)return;
  const to=DG.said&&DG.said.to?DG.said.to:b.to;
  DG.said=null;DG.res=null;DG.typed="";DG.lv=0;DG.phase="hear";
  if(!to||!DG.sc.beats[to]){diaFinish(true);return;}
  DG.at=to;
  const nb=DG.sc.beats[to];
  DG.log.push({who:"them",tr:diaText(nb.say,DG.V)});
  if(nb.end){diaFinish(true);return;}
  window.scrollTo(0,0);render();diaSay();
}
function diaFinish(done){
  if(!DG)return;
  stopPlay();
  const b=DG.sc.beats[DG.at];
  if(done&&b&&b.end)say(diaText(b.say,DG.V));
  DG.phase="end";DG.done=!!done;
  diaGrade(DG.id,!!done);
  /* Walking out is the only failure this mode has, so it is the only
     thing it puts in the book. */
  if(!done)errNote("c:"+DG.id,{m:"c",q:DG.sc.en,c:DG.sc.tr,
                               w:"left after "+DG.turns+" turn"+(DG.turns===1?"":"s")});
  window.scrollTo(0,0);render();
}
function diaQuit(){diaFinish(false);}

/* --- screens ----------------------------------------------------------- */
function diaHub(){
  let h=bar("Diyalog","conversation · keep it alive",true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">A short errand with someone who talks at normal speed and does not know you are learning. You hear them; you never read them. What ends a conversation is not the missing word — it is the pause after it, so the only thing marked here is whether you <b>finished</b>, and asking someone to repeat themselves costs you nothing at all.</p>';
  if(!ttsOK()){
    h+='<div class="card"><p class="lead">Ses yok</p><p class="sub">This browser has no speech synthesis, and this mode is nothing but listening.</p></div></div>';
    app().innerHTML=h;return;
  }
  const done=DIYALOG.filter(function(s){return S.dia&&S.dia[s.id]&&S.dia[s.id].n;}).length;
  h+='<div class="stat"><div><b>'+DIYALOG.length+'</b><span>durum</span></div>'+
     '<div><b>'+done+'</b><span>tamamlandı</span></div>'+
     '<div><b>'+diaDue().length+'</b><span>bugün</span></div></div>';

  h+='<h2 class="sec">Durumlar</h2><div class="card" style="padding:.2rem 1rem">';
  DIYALOG.forEach(function(s){
    const r=S.dia&&S.dia[s.id], n=(r&&r.n)||0;
    h+='<button class="unit" onclick="startDia(\''+s.id+'\')">'+
      '<span class="tick '+(r&&r.n?"done":"")+'">'+(r&&r.n?IC.check:s.lv)+'</span>'+
      '<span class="grow"><span class="unit-t">'+esc(s.tr)+'</span>'+
      '<span class="unit-s">'+esc(s.en)+' · '+
      (n?n+" kez tamamlandı":"hiç konuşulmadı")+'</span></span>'+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  h+='</div>';

  h+='<h2 class="sec">Tamir çantası</h2><div class="card">'+
   '<p class="sub" style="margin-bottom:.6rem">These three are always on screen, in every conversation, and each one does something different to the person you are talking to. They are not new material — you have been drilling them in Üretim as <i>kalıplar</i>. This is the first place they are the difference between finishing and walking out.</p>';
  DIA_REPAIR.forEach(function(r){
    h+='<div class="vrow">'+spkBtn(r.tr,{aria:"Listen"})+
      '<div class="grow"><div class="vtr" style="font-size:.97rem">'+esc(r.tr)+'</div>'+
      '<div class="ven">'+esc(r.en)+' · '+
      (r.lv>=2?"they rephrase it in plainer words":r.rate<0.75?"they say it again, much slower":"they say it again, slower")+'</div></div></div>';
  });
  h+='</div>';

  h+='<p class="foot">Nothing you say is recorded and nothing but a number is marked.<br>The prices, times and places change every run, so the answer cannot be remembered — only heard.</p></div>';
  app().innerHTML=h;
}

function diaRun(){
  if(!DG){diaHub();return;}
  if(DG.phase==="end"){diaEnd();return;}
  const b=diaBeat();
  let h=bar(DG.sc.tr,(DG.turns+1)+". tur · "+DG.rep+" tamir",true)+'<div class="wrap">';
  /* The other person is heard, never read. There is deliberately no free
     replay button: if hearing it again were one tap away the repair kit
     would be decoration, and the reflex this mode exists to build would
     never be needed. */
  h+='<div class="card" style="text-align:center;padding:1.7rem 1rem">'+
   '<p style="font-size:2rem;margin:0;color:var(--turk)">'+IC.spk+'</p>'+
   '<p class="tiny" style="margin-top:.5rem">'+
   (DG.lv>=2?"rephrased":DG.lv>=1?"said again, slower":"they are speaking · nothing is written down")+'</p></div>';

  if(DG.phase==="model"){
    const last=DG.log[DG.log.length-1];
    h+='<div class="card" style="text-align:center;padding:1.3rem 1rem">'+
     '<p class="tiny" style="margin:0">'+(last&&last.num?"senin cevabın":"sen")+'</p>'+
     '<p style="font-family:\'Crimson Pro\',serif;font-size:1.5rem;line-height:1.35;margin:.3rem 0 0">'+
     esc(last?last.tr:"")+'</p>';
    if(last&&last.num){
      const v=DG.V[b.want];
      h+='<p class="sub" style="margin-top:.4rem">'+(DG.res?"Doğru":"O "+esc(v.show||v.t)+" demişti")+'</p>';
    }
    h+='</div>';
    if(last&&last.num&&!DG.res)
      h+='<div class="fb no"><b>Yanlış duydun</b>The conversation carries on — in a shop you would hand over the wrong note and be corrected, not walk out. It goes in the book under the same shape Sayılar drills.</div>';
    h+='<button class="btn" onclick="diaNext()">Devam</button></div>';
    app().innerHTML=h;return;
  }

  /* Ask for what was actually said: a time is not a quantity, and a
     prompt that calls it one reads as a mistake in the app rather than a
     question about Turkish. */
  const kind=b.want&&DG.V[b.want]?DG.V[b.want].kind:"";
  h+='<p class="qn">'+(b.want?(kind==="saat"?"Saat kaç?":kind==="fiyat"?"Kaç para?":"Kaç?")+
    " · type what they said":"Ne diyorsun? · say it, then tap it")+'</p>';
  if(b.want){
    const v=DG.V[b.want];
    h+='<input class="inp" id="dgbox" inputmode="decimal" autocapitalize="off" autocomplete="off" '+
     'autocorrect="off" spellcheck="false" placeholder="'+
     (v.kind==="saat"?"3:15":v.kind==="fiyat"?"180":"5")+'" value="'+esc(DG.typed||"")+'">'+
     '<button class="btn" onclick="diaCheck()">Kontrol et</button>';
  }else{
    (b.opts||[]).forEach(function(o,i){
      h+='<button class="opt" onclick="diaPick('+i+')">'+esc(diaText(o.en,DG.V,"en"))+'</button>';
    });
  }
  /* The kit shows its Turkish rather than asking you to compose it. A
     repair is a memorised whole reached for at speed — that is why these
     live in the prefab bank — and a two-tap repair is no repair at all
     when you are already lost. */
  h+='<h2 class="sec">Anlamadıysan</h2>';
  DIA_REPAIR.forEach(function(r,i){
    h+='<button class="opt rep" onclick="diaRepair('+i+')">'+esc(r.tr)+
      '<span class="ven" style="display:block">'+esc(r.en)+'</span></button>';
  });
  h+='<button class="btn ghost" onclick="diaQuit()">Vazgeç · walk away</button>';
  h+='<p class="foot">Asking again is free and always will be.<br>The only thing this mode marks you down for is leaving.</p></div>';
  app().innerHTML=h;
  const box=document.getElementById("dgbox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")diaCheck();});
  }
}

function diaEnd(){
  const r=S.dia&&S.dia[DG.id], n=(r&&r.n)||0;
  let h=bar(DG.sc.tr,"Bitti",true)+'<div class="wrap">';
  /* The headline is the outcome, not a number — the only question this
     mode asks is whether you got to the end. */
  h+='<div class="score"><div class="big '+(DG.done?"pass":"fail")+'" '+
   'style="font-size:2.6rem">'+(DG.done?"Tamamlandı":"Yarıda kaldı")+'</div>'+
   '<p class="sub">'+(DG.done?"you finished the errand":"you left before the end")+'</p></div>';
  h+='<div class="stat"><div><b>'+DG.turns+'</b><span>tur</span></div>'+
     '<div><b>'+DG.rep+'</b><span>tamir</span></div>'+
     '<div><b>'+(DG.nums?DG.numOk+"/"+DG.nums:"—")+'</b><span>sayı</span></div></div>';
  h+='<div class="card"><p class="sub">'+
   (DG.done?"Finished"+(n>1?", for the "+n+"th time":"")+". The repairs are not a score — nothing keeps count of them between runs, and nothing ever will. They are what finishing cost today, and the number falls by itself once the phrases stop having to be found."
          :"You left. That is the one thing this mode counts against you, because it is the one thing that actually ends a conversation — the word you missed never does. Every repair was there and free.")+
   (DG.nums&&DG.numOk<DG.nums?" The price or the time got past you; that one is a Sayılar weakness and it is in the book under the shape Sayılar drills.":"")+'</p></div>';
  /* The transcript is the reward for getting to the end: now you may read
     what you were hearing. */
  h+='<h2 class="sec">Ne konuşuldu</h2><div class="card" style="padding:.4rem 1rem">';
  DG.log.forEach(function(l){
    const mine=l.who==="me";
    h+='<p style="margin:.45rem 0;'+(mine?"text-align:right":"")+'">'+
      '<span class="tiny" style="display:block">'+(mine?(l.rep?"tamir":"sen"):"o")+'</span>'+
      '<span style="font-family:\'Crimson Pro\',serif;font-size:1.15rem;color:'+
      (l.num&&!l.ok?"var(--bole)":mine?"var(--cobalt)":"var(--ink)")+'">'+esc(l.tr)+'</span></p>';
  });
  h+='</div>';
  h+='<button class="btn" onclick="startDia(\''+DG.id+'\')">Bir daha</button>'+
   '<button class="btn ghost" onclick="DG=null;go(\'diyalog\')">Diyalog</button></div>';
  app().innerHTML=h;
}
