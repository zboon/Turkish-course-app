/* Hata defteri: the record of what went wrong, and why. */

/* ===================== hata · the mistake book ===================== */
/* The app has seven places that can tell a learner they were wrong, and
   until now every one of them threw the finding away the moment the
   screen changed. The quiz kept `{score,of,at}`; Üretim, Dinleme,
   Tekrar, Dilbilgisi and Yolda kept a box number. So a learner could
   fail the same passive construction eleven times and the app had no
   idea, and the `why` written for every multiple-choice drill was shown
   once and discarded.

   What this is NOT is another queue. Every mode already brings a wrong
   answer back today — that is what box 0 means — so a "drill your
   mistakes" runner would re-ask what is already coming. The gap is not
   repetition, it is **the record**: what did I get wrong, what did I say
   instead, why was it wrong, and what am I getting wrong *repeatedly*.
   Nothing in the app could answer the last one.

   `S.err` is keyed by the item, not appended as a log, so the count is
   the point: `n` is how many times this exact thing has caught you out.
   A list would grow without saying anything; a map says "eleven times".

   Keys reuse each mode's own so the same item missed in two modes is one
   entry — a sentence fumbled in the car and at a desk is one weakness:
     q:<unitId>#<i>   a unit drill       p:<i>   a placement question
     s:<unitId>#<i>   a passage line     k:<i>   a prefab
     d: / a:          dictation, audio-first
     r:<fold(word)>   a vocabulary item  y:<unitId>  a grammar point */
const ERR_MAX=400;
const ERR_MODES=[["q","Alıştırma","unit drills"],["s","Üretim","producing"],
                 ["d","Dikte","transcribing"],["a","Ses önce","understanding"],
                 ["r","Tekrar","vocabulary"],["y","Dilbilgisi","grammar"]];

function errNote(k,o){
  if(!k||!o||!o.c)return;
  if(!S.err)S.err={};
  const had=S.err[k];
  S.err[k]={m:o.m,q:String(o.q||""),c:String(o.c),a:String(o.a||""),
            w:String(o.w||""),to:o.to||"",
            at:dayNum(),n:((had&&had.n)||0)+1};
  errTrim();save();
}
/* Bounded, because a learner who uses this for a year would otherwise
   carry every slip they ever made.

   The count is what gets evicted on, NOT the date. Ranking by age first
   looked reasonable and is exactly backwards: a thing that has caught
   you nine times is the most valuable entry in the book, and dropping
   it to keep four hundred one-off slips from this morning throws away
   the only question this feature exists to answer. So the least
   repeated goes first, and the oldest breaks a tie between equals. */
function errTrim(){
  const ks=Object.keys(S.err);
  if(ks.length<=ERR_MAX)return;
  ks.sort(function(a,b){
    const x=S.err[a],y=S.err[b];
    return (x.n-y.n)||(x.at-y.at);
  });
  ks.slice(0,ks.length-ERR_MAX).forEach(function(k){delete S.err[k];});
}
function errList(){
  if(!S.err)S.err={};
  return Object.keys(S.err).map(function(k){
    const e=S.err[k];
    return {k:k,m:e.m,q:e.q,c:e.c,a:e.a,w:e.w,to:e.to,at:e.at,n:e.n};
  });
}
function errRecent(){
  return errList().sort(function(a,b){return (b.at-a.at)||(b.n-a.n);});
}
/* The one question nothing else in the app could answer. */
function errRepeat(){
  return errList().filter(function(e){return e.n>1;})
    .sort(function(a,b){return (b.n-a.n)||(b.at-a.at);});
}
function errByMode(){
  const out={};
  errList().forEach(function(e){out[e.m]=(out[e.m]||0)+1;});
  return out;
}
/* The generated drills are the one place the app already thinks in
   patterns rather than sentences — S.prod keys them "g:<frame>:<tense>"
   and "t:<move>". A pattern sitting on box 0 is one that was drilled and
   missed, so it reads straight out without any new bookkeeping. */
function errPatterns(){
  if(!S.prod)return [];
  return Object.keys(S.prod).filter(function(k){
    return (k.indexOf("g:")===0||k.indexOf("t:")===0)&&S.prod[k].b===0;
  }).map(function(k){
    const p=k.split(":");
    if(p[0]==="t"){
      const m=MOVES.find(function(x){return x.k===p[1];});
      return {k:k,tr:m?m.tr:p[1],en:m?m.en:"transformation"};
    }
    const f=FRAMES[p[1]], t=TENSES.find(function(x){return x.k===p[2];});
    return {k:k,tr:(f?f.lab:p[1])+(t?" · "+t.tr:""),en:t?t.en:"pattern"};
  });
}
/* Where a key names a unit, so a row can offer to go back to it.
   "s:b1u3#4" and "d:b1u3#4" do; "k:12" is a prefab and belongs to none. */
function errUnitOf(k){
  const m=/^[a-z]:([a-z0-9]+)#\d+$/.exec(String(k));
  return (m&&unit(m[1]))?m[1]:"";
}
/* One shape for every drill in the quiz engine: multiple choice keeps the
   right answer at a[c], the other two keep it at c, and `why` is written
   for the first two. Unit drills key by unit and position, placement
   questions by position in PLACEMENT. */
function quizNote(it,given){
  if(!it)return;
  const c=it.t==="mc"?it.a[it.c]:it.c;
  const key=it.uid?("q:"+it.uid+"#"+it.di):(it.pi!==undefined?"p:"+it.pi:"");
  if(!key)return;
  errNote(key,{m:"q",q:it.q,c:c,a:given,w:it.why||"",to:it.uid||""});
}
/* Silent removal, for a mark the learner overruled — errForget() is the
   button and re-renders, which a grading path must not do. */
function errForget2(k){
  if(S.err&&S.err[k]){delete S.err[k];save();}
}
function errForget(k){
  if(S.err)delete S.err[k];
  save();render();
}
function errWipe(){
  if(typeof confirm==="function"&&!confirm("Clear the whole mistake book? The drills themselves are not affected."))return;
  S.err={};save();render();
}
function errSay(t){if(t)say(t);}

/* --- screens ---------------------------------------------------------- */
function errRow(e){
  const mode=ERR_MODES.find(function(m){return m[0]===e.m;});
  const days=dayNum()-e.at;
  let h='<div class="card" style="padding:.8rem 1rem">';
  h+='<div class="row" style="gap:.4rem;margin-bottom:.4rem">'+
   '<span class="pill'+(e.n>2?" bole":e.n>1?" gold":"")+'" style="flex:0 0 auto">'+
   (e.n>1?e.n+"×":"1×")+'</span>'+
   '<span class="tiny grow">'+esc(mode?mode[1]+" · "+mode[2]:e.m)+
   ' · '+(days<=0?"bugün":days===1?"dün":days+" gün önce")+'</span></div>';
  if(e.q)h+='<p class="sub" style="margin:0 0 .4rem">'+esc(e.q).replace(/___/g,'<span class="blank">____</span>')+'</p>';
  if(e.a)h+='<p class="dline" style="font-size:1.05rem;margin:0"><span class="dw extra">'+esc(e.a)+'</span></p>';
  h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.25rem;margin:.2rem 0 0;color:var(--turk);font-weight:600">'+esc(e.c)+'</p>';
  if(e.w)h+='<p class="tiny" style="margin:.35rem 0 0">'+esc(e.w)+'</p>';
  h+='<div class="row" style="gap:.4rem;margin-top:.5rem">'+
   '<button class="sbtn" onclick="errSay(\''+jsq(e.c)+'\')">'+IC.spk+' dinle</button>'+
   (e.to?'<button class="sbtn" onclick="go(\'unit\',\''+jsq(e.to)+'\',\'g\')">üniteye git</button>':'')+
   '<span class="grow"></span>'+
   '<button class="sbtn" onclick="errForget(\''+jsq(e.k)+'\')">artık biliyorum ×</button></div>';
  h+='</div>';
  return h;
}
function renderHata(){
  const all=errList(), rep=errRepeat(), today=all.filter(function(e){return e.at>=dayNum();});
  let h=bar("Hata defteri","what went wrong, and why",true)+'<div class="wrap">';
  if(!all.length){
    h+='<div class="card"><p class="lead">Defter boş</p>'+
     '<p class="sub">Nothing has gone wrong yet — or nothing has been attempted. Every wrong answer in a quiz, in Üretim, Dinleme, Tekrar, Dilbilgisi or Yolda lands here with its explanation, and anything that catches you out twice moves to the top.</p>'+
     '<button class="btn" onclick="home()">Bugüne dön</button></div></div>';
    app().innerHTML=h;return;
  }
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">Every mode already brings a wrong answer back today by itself, so this is not another queue — it is the record. What you said, what was right, why, and how often the same thing has caught you.</p>';
  h+='<div class="stat"><div><b>'+rep.length+'</b><span>tekrarlayan</span></div>'+
     '<div><b>'+all.length+'</b><span>toplam</span></div>'+
     '<div><b>'+today.length+'</b><span>bugün</span></div></div>';

  if(rep.length){
    h+='<h2 class="sec">Tekrarlayanlar · caught you twice or more</h2>';
    h+='<p class="tiny" style="margin:0 .2rem .4rem">This is the list the app could not show you before. A thing missed four times is not bad luck.</p>';
    rep.slice(0,12).forEach(function(e){h+=errRow(e);});
    if(rep.length>12)h+='<p class="tiny" style="margin-top:.4rem">and '+(rep.length-12)+' more.</p>';
  }

  const by=errByMode(), pats=errPatterns();
  h+='<h2 class="sec">Nerede zayıfsın</h2><div class="card">';
  const max=Math.max.apply(null,ERR_MODES.map(function(m){return by[m[0]]||0;}).concat([1]));
  ERR_MODES.forEach(function(m){
    const n=by[m[0]]||0;
    h+='<div style="display:flex;align-items:center;gap:.6rem;margin:.3rem 0">'+
      '<span class="tiny" style="width:5.2rem;text-align:right;flex:0 0 auto">'+m[1]+'</span>'+
      '<span style="flex:1;height:12px;background:var(--sunk);border-radius:99px;overflow:hidden">'+
      '<span style="display:block;height:100%;width:'+Math.round(100*n/max)+'%;border-radius:99px;background:var(--bole)"></span></span>'+
      '<span class="tiny" style="width:2.2rem;flex:0 0 auto">'+n+'</span></div>';
  });
  h+='<p class="tiny" style="margin-top:.5rem">Distinct items missed, not attempts. A tall bar is a skill to work on rather than a word to relearn.</p></div>';

  if(pats.length){
    h+='<div class="card"><p class="lead" style="font-size:.95rem">Kurma ve Dönüştürme</p>'+
     '<p class="sub" style="margin-bottom:.5rem">The generated drills are scheduled by pattern rather than by sentence, so these are patterns you are currently getting wrong — not sentences you happened to miss.</p><div class="pillrow">';
    pats.slice(0,10).forEach(function(p){
      h+='<span class="pill bole">'+esc(p.tr)+'</span>';
    });
    h+='</div><button class="btn ghost" onclick="startProd(\'t\')">Dönüştürme · drill these</button></div>';
  }

  h+='<h2 class="sec">Son hatalar</h2>';
  errRecent().slice(0,15).forEach(function(e){h+=errRow(e);});

  h+='<div class="card"><p class="lead">Defteri temizle</p>'+
   '<p class="sub">Clearing the book changes nothing about the drills — wrong answers still come back on their own schedule.</p>'+
   '<button class="btn ghost" onclick="errWipe()">Hepsini sil</button></div>';
  h+='<p class="foot">Kept to the '+ERR_MAX+' most recent, and a thing missed often outlives a thing missed once.</p></div>';
  app().innerHTML=h;
}
