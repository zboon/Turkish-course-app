/* The Turkish language engine: morphology, and the generator that
   builds drill sentences out of it. Pure functions — no DOM, no state
   — which is why validate.js can lift this out of the build and check
   it against a table of hand-checked forms. */

/* ===================== biçimbilim · morphology ===================== */
/* Turkish is regular enough to generate and irregular enough to get
   wrong. This builds forms from a stem plus the flags in LEX; anything
   it cannot derive is listed in that entry's irr. validate.js holds a
   golden set of hand-checked forms, because a drill that teaches wrong
   Turkish is worse than no drill at all. */
const VOW="aeıioöuü", BACK="aıou", VOICELESS="fstkçşhp";
const SOFTEN={"p":"b","ç":"c","t":"d","k":"ğ"};

function lastVowel(w){for(let i=w.length-1;i>=0;i--)if(VOW.indexOf(w[i])>-1)return w[i];return "a";}
function A(w){return BACK.indexOf(lastVowel(w))>-1?"a":"e";}               /* two-way  */
function I(w){const v=lastVowel(w);                                        /* four-way */
  return v==="a"||v==="ı"?"ı":v==="e"||v==="i"?"i":v==="o"||v==="u"?"u":"ü";}
function endsVowel(w){return VOW.indexOf(w[w.length-1])>-1;}
function D(w){return VOICELESS.indexOf(w[w.length-1])>-1?"t":"d";}         /* fıstıkçı şahap */
function syllables(w){let n=0;for(const c of w)if(VOW.indexOf(c)>-1)n++;return n;}

/* p ç t k soften before a vowel, but only for the words that do it —
   kitap → kitabı, yet top → topu. After n, k goes to g: renk → rengi. */
function soften(s,e){
  if(!e||!e.soft)return s;
  const last=s[s.length-1];
  if(last==="k"&&s[s.length-2]==="n")return s.slice(0,-1)+"g";
  return SOFTEN[last]?s.slice(0,-1)+SOFTEN[last]:s;
}
/* şehir → şehr, burun → burn: the last vowel falls out before a vowel. */
function dropVowel(s,e){
  if(!e||!e.drop)return s;
  for(let i=s.length-1;i>=0;i--)if(VOW.indexOf(s[i])>-1)return s.slice(0,i)+s.slice(i+1);
  return s;
}
function stemFor(e){return soften(dropVowel(e.t,e),e);}                    /* before a vowel */
/* Loanwords that break harmony: kalp has a back vowel but takes front
   endings — kalbi, kalbe, kalpte. front:1 forces e/i, front:"ü" forces
   e/ü (usul → usulü). There is no rule for these; they are listed. */
function eA(e){return e&&e.front?"e":A(e.t);}
function eI(e){return e&&e.front?(e.front==="ü"?"ü":"i"):I(e.t);}
function irr(e,k){return e&&e.irr&&e.irr[k];}

/* --- noun endings ------------------------------------------------- */
/* The full noun paradigm. nPlur, nAbl and nP1 are not on screen yet —
   they are here because a half-paradigm is worse than a whole one, and
   validate.js holds hand-checked forms for all of them. */
function nPlur(e){const s=e.t;return s+"l"+eA(e)+"r";}
function nAcc(e){return irr(e,"acc")||(endsVowel(e.t)?e.t+"y"+eI(e):stemFor(e)+eI(e));}
function nDat(e){return irr(e,"dat")||(endsVowel(e.t)?e.t+"y"+eA(e):stemFor(e)+eA(e));}
function nLoc(e){const s=e.t;return irr(e,"loc")||s+D(s)+eA(e);}           /* no softening */
function nAbl(e){const s=e.t;return irr(e,"abl")||s+D(s)+eA(e)+"n";}
function nGen(e){return irr(e,"gen")||(endsVowel(e.t)?e.t+"n"+eI(e)+"n":stemFor(e)+eI(e)+"n");}
function nP1(e){return irr(e,"p1")||(endsVowel(e.t)?e.t+"m":stemFor(e)+eI(e)+"m");}
function nP3(e){return irr(e,"p3")||(endsVowel(e.t)?e.t+"s"+eI(e):stemFor(e)+eI(e));}

/* --- persons ------------------------------------------------------- */
/* Vowel-initial endings soften a final k: gelecek → geleceğim. */
function glue(w,end){
  if(end&&VOW.indexOf(end[0])>-1&&w[w.length-1]==="k")w=w.slice(0,-1)+"ğ";
  return w+end;
}
/* after -yor, -AcAk and the aorist */
function pers1(w,p){
  if(p===0)return glue(w,I(w)+"m");
  if(p===1)return glue(w,"s"+I(w)+"n");
  if(p===2)return w;
  if(p===3)return glue(w,I(w)+"z");
  if(p===4)return glue(w,"s"+I(w)+"n"+I(w)+"z");
  return glue(w,"l"+A(w)+"r");
}
/* after -DI */
function pers2(w,p){
  if(p===0)return w+"m";
  if(p===1)return w+"n";
  if(p===2)return w;
  if(p===3)return w+"k";
  if(p===4)return w+"n"+I(w)+"z";
  return w+"l"+A(w)+"r";
}

/* --- verb forms ----------------------------------------------------- */
function vStem(e){return e.t.replace(/(mak|mek)$/,"");}
/* -(I)yor: a stem-final vowel falls out, and the ending harmonises to
   what is left — bekle → bekliyor, oku → okuyor, git → gidiyor. */
function vProg(e,p,neg){
  let st=vStem(e);
  if(neg){ st=st+"m"+A(st); st=st.slice(0,-1); }
  else if(irr(e,"prog")) return pers1(e.irr.prog+"yor",p);   /* yi → yiyor */
  else if(endsVowel(st)) st=st.slice(0,-1);
  else st=soften(st,e);
  return pers1(st+I(st)+"yor",p);
}
function vPast(e,p,neg){
  let st=vStem(e);
  if(neg)st=st+"m"+A(st);
  const base=neg?st+"d"+I(st):st+D(st)+I(st);
  return pers2(base,p);
}
function vFut(e,p,neg){
  if(!neg&&irr(e,"fut"))return pers1(e.irr.fut,p);
  let st=vStem(e);
  if(neg)st=st+"m"+A(st);
  const link=endsVowel(st)||neg?"y":"";
  if(!neg&&!endsVowel(st))st=soften(st,e);
  return pers1(st+link+A(st)+"c"+A(st)+"k",p);
}
/* Aorist: -Ir on polysyllables and on the thirteen irregular
   monosyllables, -Ar on the rest, bare -r after a vowel. Its negative
   is the odd one out: gelmem, gelmezsin. */
function vAor(e,p,neg){
  const raw=vStem(e);
  if(neg){
    const st=raw+"m"+A(raw);
    if(p===0)return st+"m";
    if(p===3)return st+"y"+I(st)+"z";                        /* gelmeyiz */
    return pers1(st+"z",p);
  }
  let st=endsVowel(raw)?raw:soften(raw,e);
  let end;
  if(endsVowel(raw))end="r";
  else if(syllables(raw)>1||e.aor)end=I(raw)+"r";
  else end=A(raw)+"r";
  return pers1(st+end,p);
}
const TENSES=[
 {k:"prog",tr:"şimdiki zaman",en:"present",f:vProg},
 {k:"past",tr:"görülen geçmiş",en:"past",f:vPast},
 {k:"fut", tr:"gelecek zaman",en:"future",f:vFut},
 {k:"aor", tr:"geniş zaman",en:"habitual",f:vAor}
];
function conj(e,tense,p,neg){const t=TENSES.find(x=>x.k===tense);return t?t.f(e,p,neg):"";}

/* ===================== kurma · generative drills ===================== */
/* A drill is a spec — who, which verb, which tense, which frame — that
   renders into both languages. Transformations are then the same spec
   with one field changed, which is why "make it past" can always show a
   correct answer instead of an approximation. */
const PRON=[["I","am","my"],["you","are","your"],["he","is","his"],["we","are","our"],["you (plural)","are","your"],["they","are","their"]];
const NOFRILL={ev:["home","at home","from home"],okul:["to school","at school","from school"]};

function the(e){return "the "+e.en.split(",")[0].trim();}
function place(e,which){const p=NOFRILL[e.t];if(p)return p[which];
  const at=e.lp||"at";
  return [which===0?"to ":which===1?at+" ":"from "][0]+the(e);}

/* English verb, by tense and polarity. */
function engV(e,tense,p,neg){
  const [base,ger,past,s3]=e.e, s=PRON[p][0], be=PRON[p][1];
  /* Turkish says seviyorum; English says "I like", not "I am liking". */
  if(tense==="prog"&&e.stative)return s+(neg?(p===2?" does not ":" do not ")+base:" "+(p===2?s3:base));
  if(tense==="prog")return s+" "+be+(neg?" not ":" ")+ger;
  if(tense==="past")return s+(neg?" did not "+base:" "+past);
  if(tense==="fut")return s+" will"+(neg?" not ":" ")+base;
  if(neg)return s+(p===2?" does not ":" do not ")+base;
  return s+" "+(p===2?s3:base);
}
/* The question particle is a separate word and takes the person on
   itself — geliyor muyum — except in the past, where the verb keeps it:
   geldin mi. */
function qPart(w,p){
  const m="m"+I(w);
  if(p===0)return m+"y"+I(m)+"m";
  if(p===1)return m+"s"+I(m)+"n";
  if(p===3)return m+"y"+I(m)+"z";
  if(p===4)return m+"s"+I(m)+"n"+I(m)+"z";
  return m;
}
function askTR(e,tense,p,neg){
  if(tense==="past"){const f=conj(e,tense,p,neg);return f+" m"+I(f)+"?";}
  if(p===5){const f=conj(e,tense,5,neg);return f+" m"+I(f)+"?";}
  const base=conj(e,tense,2,neg);
  return base+" "+qPart(base,p)+"?";
}
function askEN(e,tense,p,neg){
  const [base,ger,past]=e.e, s=PRON[p][0], be=PRON[p][1];
  if(tense==="prog"&&e.stative)return (p===2?"Does ":"Do ")+s+(neg?" not ":" ")+base+"?";
  if(tense==="prog")return cap(be)+" "+s+(neg?" not ":" ")+ger+"?";
  if(tense==="past")return (neg?"Did "+s+" not ":"Did "+s+" ")+base+"?";
  if(tense==="fut")return "Will "+s+(neg?" not ":" ")+base+"?";
  return (p===2?"Does ":"Do ")+s+(neg?" not ":" ")+base+"?";
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}            /* English */
/* Turkish capitalises i as İ and ı as I. Getting this wrong is the most
   visible possible mistake, so it has its own function. */
function capTR(s){const c=s.charAt(0);
  return (c==="i"?"İ":c==="ı"?"I":c.toUpperCase())+s.slice(1);}

/* --- the frames ------------------------------------------------------ */
/* Each returns {en, tr}. The spec carries v (verb), n (noun), a
   (adjective), p (person), t (tense), neg, ask. */
const FRAMES={
 bare:{need:[],  lab:"fiil · verb alone",
   en:s=>cap(engV(s.v,s.t,s.p,s.neg))+".",
   tr:s=>capTR(conj(s.v,s.t,s.p,s.neg))+"."},
 obj:{need:["obj"], lab:"nesne · object",
   /* Turkish takes a plain accusative where English sometimes needs a
      preposition: "otobüsü bekliyorum" is "I am waiting FOR the bus". */
   en:s=>cap(engV(s.v,s.t,s.p,s.neg))+" "+(s.v.oprep?s.v.oprep+" ":"")+the(s.n)+".",
   tr:s=>capTR(nAcc(s.n))+" "+conj(s.v,s.t,s.p,s.neg)+"."},
 dat:{need:["dat"], lab:"yönelme · to",
   en:s=>{const pr=s.v.prep;
     const tail=pr==="to"?place(s.n,0):pr?pr+" "+the(s.n):the(s.n);
     return cap(engV(s.v,s.t,s.p,s.neg))+" "+tail+".";},
   tr:s=>capTR(nDat(s.n))+" "+conj(s.v,s.t,s.p,s.neg)+"."},
 loc:{need:["loc"], lab:"bulunma · at",
   en:s=>cap(engV(s.v,s.t,s.p,s.neg))+" "+place(s.n,1)+".",
   tr:s=>capTR(nLoc(s.n))+" "+conj(s.v,s.t,s.p,s.neg)+"."},
 adj:{need:["adj"], lab:"sıfat · description",
   en:s=>cap(the(s.n))+" is"+(s.neg?" not ":" ")+s.a.en.split(",")[0].trim()+".",
   tr:s=>capTR(s.n.t)+" "+s.a.t+(s.neg?" değil":"")+"."},
 gen:{need:["obj"], lab:"tamlama · possessive",
   en:s=>cap(the(s.owner))+"'s "+s.n.en.split(",")[0].trim()+".",
   tr:s=>capTR(nGen(s.owner))+" "+nP3(s.n)+"."},
 ask:{need:[], lab:"soru · question",
   en:s=>askEN(s.v,s.t,s.p,s.neg),
   tr:s=>capTR(askTR(s.v,s.t,s.p,s.neg))}
};
function specText(s){const f=FRAMES[s.f];return {en:f.en(s),tr:f.tr(s),lab:f.lab};}

/* --- building a spec -------------------------------------------------- */
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function lexOf(p){return LEX.filter(e=>e.p===p);}
function byName(t){return LEX.find(e=>e.t===t);}
function drillable(){return lexOf("v").filter(e=>!e.aux&&e.e);}
/* Some verbs cannot stand without an object — "Did we give?" is not a
   prompt anyone can answer. */
function standalone(){return drillable().filter(e=>!e.needsObj);}

function makeSpec(kind){
  const t=pick(["prog","prog","past","fut","aor"]);     /* present carries the load */
  const p=Math.floor(Math.random()*6);
  const neg=Math.random()<0.3;
  if(kind==="adj"){
    const a=pick(lexOf("a")), n=byName(pick(a.n));
    return {f:"adj",a:a,n:n,p:2,t:t,neg:neg};
  }
  if(kind==="gen"){
    const owner=byName(pick(OWNERS)), n=byName(pick(OWNED));
    return {f:"gen",owner:owner,n:n,p:2,t:t,neg:false};
  }
  let f=kind;
  const pool=f==="obj"?drillable().filter(e=>e.obj)
          :f==="dat"?drillable().filter(e=>e.dat)
          :f==="loc"?drillable().filter(e=>e.loc)
          :standalone();
  const v=pick(pool);
  const n=f==="obj"?byName(pick(v.obj)):f==="dat"?byName(pick(v.dat)):f==="loc"?byName(pick(v.loc)):null;
  return {f:f,v:v,n:n,p:p,t:t,neg:neg};
}
/* Only a person owns things, and only some things are owned. */
const OWNERS=["çocuk","öğretmen","öğrenci","anne","baba","arkadaş"];
const OWNED=["kitap","araba","ev","telefon","kalem","isim","para","köpek","kedi"];
const KINDS=["bare","obj","dat","loc","adj","gen","ask"];

/* --- transformations --------------------------------------------------- */
/* The given sentence and the target are the same spec, one field apart. */
const MOVES=[
 {k:"neg",  tr:"Olumsuz yap",   en:"make it negative", ok:s=>!s.neg&&s.f!=="gen", go:s=>Object.assign({},s,{neg:true})},
 {k:"pos",  tr:"Olumlu yap",    en:"make it positive", ok:s=>s.neg,               go:s=>Object.assign({},s,{neg:false})},
 {k:"past", tr:"Geçmişe çevir", en:"put it in the past", ok:s=>s.t!=="past"&&s.f!=="adj"&&s.f!=="gen", go:s=>Object.assign({},s,{t:"past"})},
 {k:"fut",  tr:"Geleceğe çevir",en:"put it in the future", ok:s=>s.t!=="fut"&&s.f!=="adj"&&s.f!=="gen", go:s=>Object.assign({},s,{t:"fut"})},
 {k:"ask",  tr:"Soru yap",      en:"turn it into a question", ok:s=>s.f!=="ask"&&s.f!=="adj"&&s.f!=="gen"&&!!s.v, go:s=>Object.assign({},s,{f:"ask"})},
 {k:"biz",  tr:"“biz” yap",     en:"change it to “we”", ok:s=>s.p!==3&&s.f!=="adj"&&s.f!=="gen", go:s=>Object.assign({},s,{p:3})},
 {k:"o",    tr:"“o” yap",       en:"change it to “he”", ok:s=>s.p!==2&&s.f!=="adj"&&s.f!=="gen", go:s=>Object.assign({},s,{p:2})}
];
function makeMove(){
  for(let i=0;i<40;i++){
    const s=makeSpec(pick(["bare","obj","dat","loc"]));
    const can=MOVES.filter(m=>m.ok(s));
    if(!can.length)continue;
    const m=pick(can), to=m.go(s);
    const from=specText(s), target=specText(to);
    if(from.tr===target.tr)continue;
    return {from:from,to:target,move:m};
  }
  return null;
}


/* ===================== dikte · scoring ===================== */
/* What the learner typed against what was said, word by word.
   A whole-line compare says pass or fail; this says WHICH words went
   missing, and that is the only real error detection in the app —
   self-grading cannot see a word you never heard in the first place.

   Alignment is a longest common subsequence over fold()ed tokens, so a
   dropped word shifts nothing after it, word order still counts, and a
   learner without a Turkish keyboard is not punished for diacritics.
   Pure: no DOM, no state. */
function dictTokens(s){
  const out=[];
  String(s).split(/\s+/).forEach(function(w){
    const f=fold(w);
    if(!f)return;                       /* punctuation and dashes fold away */
    const parts=f.split(" ");
    /* fold() turns "vakt-i" into two words; there is no clean slice of the
       original for each half, so those rare pieces show folded. */
    if(parts.length===1)out.push({raw:w,f:f});
    else parts.forEach(function(p){out.push({raw:p,f:p});});
  });
  return out;
}
function dictScore(said,typed){
  const a=dictTokens(said), b=dictTokens(typed);
  const n=a.length, m=b.length;
  const L=[]; for(let i=0;i<=n;i++)L.push(new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    L[i][j]=a[i].f===b[j].f?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const ops=[]; let i=0,j=0;
  while(i<n&&j<m){
    if(a[i].f===b[j].f){ops.push({t:"ok",w:a[i].raw});i++;j++;}
    else if(L[i+1][j]>=L[i][j+1]){ops.push({t:"miss",w:a[i].raw});i++;}
    else {ops.push({t:"extra",w:b[j].raw});j++;}
  }
  while(i<n){ops.push({t:"miss",w:a[i].raw});i++;}
  while(j<m){ops.push({t:"extra",w:b[j].raw});j++;}
  const hit=ops.filter(function(o){return o.t==="ok";}).length;
  const extra=ops.filter(function(o){return o.t==="extra";}).length;
  return {ops:ops,hit:hit,of:n,extra:extra,
          pct:n?Math.round(100*hit/n):0,clean:hit===n&&extra===0};
}
/* 80% of the words, with nothing invented, is a pass. A five-word line
   forgives one word; a ten-word line forgives two. */
const DICT_PASS=80;
function dictPass(r){return !!r&&r.pct>=DICT_PASS&&r.extra===0;}

/* ===================== teşhis · naming a mistake ===================== */
/* A wrong answer used to come back as the right one and nothing else, so
   the learner saw THAT a form was wrong but never WHY. This names the
   rule — but only when one known rule turns what was typed into what was
   right, exactly. Anything it cannot explain that cleanly it leaves
   alone: a confident wrong diagnosis is worse than none, because the
   learner cannot tell it from a right one.

   It never claims the accusative or the possessive: "evi" is "the house"
   and "his house", and a machine that cannot see the sentence's meaning
   has no business choosing. The three cases it does name (-A, -DA,
   -DAn — to, at, from) are the ones a learner confuses and the ones a
   bare ending identifies. Pure: no DOM, no state, so validate.js holds
   it to a hand-checked table. */
function trLower(s){return String(s).replace(/İ/g,"i").replace(/I/g,"ı").toLowerCase();}
function diagWord(s){return trLower(s).replace(/[^a-zçğıöşüâîû]/g,"");}
function diagV(c){return !!c&&"aeıioöuüâîû".indexOf(c)>-1;}
function diagEq(a,b){return fold(a)===fold(b);}
function diagLastV(s,before){for(let i=before-1;i>=0;i--)if(diagV(s[i]))return s[i];return "";}
/* What harmony predicts after a vowel: two-way for a/e endings, four-way
   for ı/i/u/ü endings. Returns "" for anything else. */
function diagHarmony(gov,four){
  if(!gov)return "";
  const back="aıouâû".indexOf(gov)>-1;
  if(!four)return back?"a":"e";
  if(gov==="a"||gov==="ı"||gov==="â")return "ı";
  if(gov==="e"||gov==="i"||gov==="î")return "i";
  if(gov==="o"||gov==="u"||gov==="û")return "u";
  return "ü";
}
const DIAG_SOFT={p:"b",t:"d",k:"ğ",ç:"c"};
const DIAG_HARD="fstkçşhp";
const DIAG_CASE={
  abl:{re:/(n)?(d|t)(a|e)n$/, n:"ablative", f:"-DAn", m:"from"},
  loc:{re:/(n)?(d|t)(a|e)$/,  n:"locative", f:"-DA",  m:"in, at, on"},
  dat:{re:/(y|n)?(a|e)$/,     n:"dative",   f:"-(y)A",m:"to, towards"}
};
function diagCaseOf(rest){
  if(rest==="")return "bare";
  for(const k of ["abl","loc","dat"]){const m=DIAG_CASE[k].re.exec(rest);if(m&&m.index===0&&m[0]===rest)return k;}
  return null;
}
function diagnose(typed,correct){
  const t=diagWord(typed), c=diagWord(correct);
  if(!t||!c||diagEq(t,c))return null;
  /* The answer is shown as written (Ankara'dan, not ankaradan); the
     rule is worked out on the bare lower-case letters. */
  const R=String(correct).trim().replace(/^[\s"“(]+|[\s.,;:!?…"”)]+$/g,"")||c;
  /* A stem quoted from the answer keeps the answer's capital: Kitap → Kitabı. */
  const St=function(n){const x=c.slice(0,n);return R[0]!==trLower(R[0])?R[0]+x.slice(1):x;};

  if(t.length===c.length){
    const D=[];for(let i=0;i<c.length;i++)if(!diagEq(t[i],c[i]))D.push(i);
    /* Vowel harmony: every difference is a vowel of the same harmony set,
       and harmony really does predict the right one here — a loanword
       that breaks the rule (saat → saatte) gets no rule it does not obey. */
    const two=function(x){return "ae".indexOf(fold(x))>-1;}, four=function(x){return "ıiuü".indexOf(x)>-1||"iu".indexOf(fold(x))>-1&&!two(x);};
    if(D.length&&D.every(function(i){return diagV(t[i])&&diagV(c[i])&&(two(t[i])&&two(c[i])||four(t[i])&&four(c[i]));})){
      const i=D[0], gov=diagLastV(c,i), isFour=four(c[i]), want=diagHarmony(gov,isFour);
      if(want&&want===c[i])
        return {k:"uyum",t:"The last vowel before the ending is "+gov+", so "+(isFour?"four-way":"two-way")+
          " harmony gives "+c[i]+", not "+t[i]+": "+R+"."};
      return null;
    }
    if(D.length===1){
      const i=D[0], a=t[i], b=c[i];
      /* d after a voiceless consonant turns to t, and back again. */
      if(i>0&&!diagV(c[i-1])&&(a==="d"&&b==="t"||a==="t"&&b==="d")){
        if(b==="t"&&DIAG_HARD.indexOf(c[i-1])>-1)
          return {k:"dt",t:St(i)+" ends in "+c[i-1]+", one of the voiceless consonants (fıstıkçı şahap), so the ending starts with t, not d: "+R+"."};
        if(b==="d"&&DIAG_HARD.indexOf(c[i-1])<0)
          return {k:"dt",t:St(i)+" ends in "+c[i-1]+", which is voiced, so the ending keeps its d: "+R+"."};
      }
      /* Softening: a final p, t, k becomes b, d, ğ before a vowel — and
         only before a vowel. After n, k becomes g (renk → rengi). */
      const soft=DIAG_SOFT[a]===b||a==="k"&&b==="g"&&c[i-1]==="n";
      if(soft&&diagV(c[i+1]))
        return {k:"yumusama",t:"The final "+a+" softens to "+b+" when a vowel ending follows: "+St(i)+a+" → "+R+"."};
      const hard=DIAG_SOFT[b]===a||b==="k"&&a==="g";
      if(hard&&c[i+1]&&!diagV(c[i+1]))
        return {k:"yumusama",t:"No softening here: "+b+" only changes before a vowel, and this ending starts with a consonant: "+R+"."};
    }
  }
  /* Buffer letters: y, n or s join two vowels, and only two vowels. */
  if(c.length===t.length+1){
    for(let i=1;i<c.length-1;i++){
      if("yns".indexOf(c[i])>-1&&diagV(c[i-1])&&diagV(c[i+1])&&diagEq(c.slice(0,i)+c.slice(i+1),t))
        return {k:"kaynastirma",t:St(i)+" ends in a vowel and so does the ending, so a buffer "+c[i]+" goes between them: "+R+"."};
    }
  }
  if(t.length===c.length+1){
    for(let i=1;i<t.length-1;i++){
      if("yns".indexOf(t[i])>-1&&!diagV(t[i-1])&&diagV(t[i+1])&&diagEq(t.slice(0,i)+t.slice(i+1),c))
        return {k:"kaynastirma",t:"A buffer "+t[i]+" only joins two vowels. "+St(i)+" ends in a consonant, so the ending attaches directly: "+R+"."};
    }
  }
  /* To, at, from: the right answer carries one of the three, and what
     was typed is the same stem with another of them, or with none. */
  const fc=fold(c), ft=fold(t);
  for(const k of ["abl","loc","dat"]){
    const m=DIAG_CASE[k].re.exec(fc); if(!m)continue;
    const stem=fc.slice(0,m.index); if(stem.length<2||!ft.startsWith(stem))continue;
    const had=diagCaseOf(ft.slice(stem.length)); if(!had||had===k)continue;
    const want=DIAG_CASE[k];
    return {k:"hal",t:"This needs the "+want.n+" "+want.f+" ("+want.m+")"+
      (had==="bare"?"":", not the "+DIAG_CASE[had].n+" "+DIAG_CASE[had].f+" ("+DIAG_CASE[had].m+")")+": "+R+"."};
  }
  /* The word is right and the ending is missing. Worth saying plainly,
     because a learner who typed the dictionary form knows the word. */
  if(c.length>t.length&&t.length>=2){
    if(fc.startsWith(ft))
      return {k:"ek",t:"The word is right, but here it needs its ending: "+R+" ("+t+" + -"+c.slice(t.length)+")."};
    const last=t[t.length-1], sb=DIAG_SOFT[last];
    if(sb&&diagEq(c.slice(0,t.length-1)+last,t)&&c[t.length-1]===sb&&diagV(c[t.length]))
      return {k:"ek",t:"The word is right, but here it needs its ending: "+R+". The final "+last+" of "+t+" softens to "+sb+" before the vowel."};
  }
  return null;
}
/* A whole sentence: pair each missed word with the typed word nearest to
   it, and name what went wrong with each pair that one rule explains. */
function diagnoseLine(model,typed,max){
  const r=dictScore(model,typed);
  const miss=r.ops.filter(function(o){return o.t==="miss";}).map(function(o){return o.w;});
  const extra=r.ops.filter(function(o){return o.t==="extra";}).map(function(o){return o.w;});
  const out=[], used={};
  miss.forEach(function(w){
    if(out.length>=(max||2))return;
    const fw=fold(w); let best=-1, bl=0;
    extra.forEach(function(x,j){
      if(used[j])return;
      const fx=fold(x); let n=0; while(n<fw.length&&n<fx.length&&fw[n]===fx[n])n++;
      /* three letters in common, or two when one of them is that short (ev, eve) */
      if((n>=3||(n>=2&&Math.min(fw.length,fx.length)<=4))&&n>bl){best=j;bl=n;}
    });
    if(best<0)return;
    const d=diagnose(extra[best],w);
    if(d){used[best]=1;out.push(d);}
  });
  return out;
}
/* Tekrar's answers can be alternatives ("ad / isim", "ağabey (abi)") or
   phrases; try each, word by word or line by line as the shape needs. */
function diagAny(typed,answer){
  const alts=String(answer).split(/\s*\/\s*|\s*\(|\)/).map(function(s){return s.trim();}).filter(Boolean);
  for(let i=0;i<alts.length;i++){
    const a=alts[i], multi=/\s/.test(a)||/\s/.test(String(typed).trim());
    const d=multi?diagnoseLine(a,typed,1)[0]:diagnose(typed,a);
    if(d)return d;
  }
  return null;
}

/* ===================== konuşma dili · spoken forms ===================== */
/* Written Turkish and spoken Turkish spell some words differently, and the
   spoken spelling is also how people text: gidicem for gideceğim, bi for
   bir, burda for burada. A learner who types what they hear every day is
   not wrong, and marking them wrong teaches them to distrust their ears.

   So a typed answer may be taken as right when the only difference is a
   spoken form — but only ever TOWARD the answer: a spoken word counts
   when it is a spoken rendering of a word the answer actually has. Nothing
   here can turn a wrong word into a right one; it can only recognise that
   gidicem and gideceğim are one word. The callers take the result as right
   only when it equals the answer, which is what keeps it pointed that way.

   Two kinds. A short list of fixed words, and two rules that are regular
   enough to trust: the future (-AcAğIm → -IcAm) on consonant stems only,
   because vowel stems (okuyacağım) are said several ways and a guess is
   worse than a miss; and the dropped r of -yor. Everything works on
   fold()ed text, so ı and i are one letter here. */
const SP_WORDS={
  bi:["bir"], di:["degil"], bisey:["bir","sey"], hicbisey:["hicbir","sey"],
  naber:["ne","haber"], n:["ne"], noldu:["ne","oldu"],
  napiyorsun:["ne","yapiyorsun"], napiyosun:["ne","yapiyorsun"], napiyon:["ne","yapiyorsun"],
  napcan:["ne","yapacaksin"],
  burda:["burada"], surda:["surada"], orda:["orada"], nerde:["nerede"],
  dakka:["dakika"], senle:["seninle"], benle:["benimle"], buyrun:["buyurun"]
};
/* The spoken forms of one written word, folded. */
function spokenForms(w){
  const out=[];
  let m;
  /* The future. Negative first: gelmeyeceğim → gelmicem. */
  if((m=/^(.+)m(e|a)y(e|a)c(e|a)g(i)m$/.exec(w)))out.push(m[1]+"mic"+m[4]+"m");
  else if((m=/^(.*[^aeiouy])(e|a)c(e|a)(g(i)m|giz|ksin|k)$/.exec(w))&&m[1].length>=2){
    const v=/[ou][^aeiou]*$/.test(m[1])?"u":"i";           /* four-way, folded */
    const st=m[1]+v+"c"+m[3];
    const end=m[4];
    if(end==="gim")out.push(st+"m");
    else if(end==="giz")out.push(st+"z");
    else if(end==="ksin"){out.push(st+"n");out.push(st+"ksin");}
    else out.push(st+"k");
  }
  /* On a vowel stem the future is said several ways, and these are the
     ones a native speaker checked: okuyacağım → okuycam, bekleyeceğim →
     bekliycem or beklicem, söyleyeceğim → söyliycem or söylicem,
     yiyeceğim → yiycem. The stem's last a/e rises before the y; a stem
     ending in a/e may also drop that vowel (beklicem, başlıcam). First
     person only, where the checked forms are, and accepted when typed
     but never offered: the spelling of these is approximate even to the
     people who say them. */
  else if((m=/^(.*[aeiou])y(e|a)c(e|a)gi(m|z)$/.exec(w))&&m[1].length>=2){
    const s=m[1], A=m[3], end=m[4];
    out.push(s.slice(0,-1)+(/[ae]$/.test(s)?"i":s.slice(-1))+"yc"+A+end);
    if(/[ae]$/.test(s)&&s.length>=3)out.push(s.slice(0,-1)+"ic"+A+end);
  }
  /* -yor loses its r before a consonant or at the end: geliyom, geliyosun,
     geliyo, geliyodum. -Iyor always follows a vowel, which keeps yorgun out. */
  if((m=/^(.*[aeiou])yor(.*)$/.exec(w))){
    const pre=m[1]+"yo", rest=m[2];
    if(rest==="um")out.push(pre+"m");
    else if(rest==="uz")out.push(pre+"z");
    else if(rest==="")out.push(pre);
    else if(rest==="sun"){out.push(pre+"sun");out.push(pre+"n");}
    else if(!/^[aeiou]/.test(rest))out.push(pre+rest);
  }
  return out;
}
/* The typed answer with its spoken words turned back into the written
   words of the answer they render. `used` names each one, as typed, so
   the screen can say which word was a spoken form. */
function spokenToward(typed,answer){
  const A=fold(answer).split(" ").filter(Boolean), out=[], used=[];
  String(typed).split(/\s+/).forEach(function(raw){
    const fs=fold(raw).split(" ").filter(Boolean);
    let hit=false;
    fs.forEach(function(t){
      if(A.indexOf(t)>-1){out.push(t);return;}
      const lex=SP_WORDS[t];
      if(lex){out.push.apply(out,lex);hit=true;return;}
      const bs=/^(hic)?bisey(.+)$/.exec(t);
      if(bs){out.push(bs[1]?"hicbir":"bir","sey"+bs[2]);hit=true;return;}
      const w=A.find(function(a){return spokenForms(a).indexOf(t)>-1;});
      if(w){out.push(w);hit=true;return;}
      out.push(t);
    });
    if(hit)used.push(raw.replace(/^[^\p{L}]+|[^\p{L}']+$/gu,""));
  });
  return {text:out.join(" "),used:used};
}

/* Sen or siz. "How are you?" is Nasılsın to a friend and Nasılsınız to
   anyone else, and English cannot say which, so where nothing in the
   sentence decides it the other you is right too. A learner who wrote
   the polite form to "Pleased to meet you. How are you?" was marked
   wrong for it.
   Only -sIn ↔ -sInIz, and only after what makes -sIn certainly "you":
   the present -yor, the future, -mAlI, -mIş, the question particle, and
   a short list of words said of a person. The same ending on a bare verb
   is the third-person command — Kolay gelsin, Geçmiş olsun — where
   gelsiniz would be wrong, and the aorist (gelirsin, but otursun) cannot
   be told from a verb stem in r, so both are left alone: a miss is the
   safe direction. Nothing moves when the sentence already has a sen or
   siz word, or the English names the register. Works on folded text,
   like spokenToward, and only ever toward a word the answer has. */
const SIZ_BASE=/(yor|..cak|..cek|meli|mali|mis|mus)$/;
const SIZ_WORDS=["nasil","iyi","hazir","emin","hasta","yorgun","kim","nerede","nereli","memnun","mutlu","evli","musait","mesgul","mi","mu"];
const SIZ_PRON=/^(sen|siz|seni|sizi|sana|size|senin|sizin|senden|sizden|sende|sizde|seninle|sizinle)$/;
function sizSwap(w){
  let m=/^(.+)s([iu])n\2z$/.exec(w);
  if(m&&(SIZ_BASE.test(m[1])||SIZ_WORDS.indexOf(m[1])>-1))return m[1]+"s"+m[2]+"n";
  m=/^(.+)s([iu])n$/.exec(w);
  if(m&&(SIZ_BASE.test(m[1])||SIZ_WORDS.indexOf(m[1])>-1))return w+m[2]+"z";
  return null;
}
function sizToward(typed,answer,ctx,en){
  const A=fold(answer).split(" ").filter(Boolean), used=[];
  const blocked=fold((ctx||"")+" "+answer).split(" ").some(function(t){return SIZ_PRON.test(t);})||
    /\b(informal|formal|polite|politely|friend|several|plural)\b/i.test(en||"");
  const out=[];
  String(typed).split(/\s+/).forEach(function(raw){
    let hit=false;
    fold(raw).split(" ").filter(Boolean).forEach(function(t){
      if(blocked||A.indexOf(t)>-1){out.push(t);return;}
      const w=sizSwap(t);
      if(w&&A.indexOf(w)>-1){out.push(w);hit=true;return;}
      out.push(t);
    });
    if(hit)used.push(raw.replace(/^[^\p{L}]+|[^\p{L}']+$/gu,""));
  });
  return {text:out.join(" "),used:used};
}

/* ===================== başka türlü · the other ways to say it ===================== */
/* A typed answer is one way of saying the thing, and often not the only
   one. Whatever the learner gives, the others are shown beside it: the
   spoken form of a written answer, the written form of a spoken one, the
   short form without a pronoun the ending already carries, and the long
   form with it. */

/* How a written sentence is said — the forms that are safe with anyone.
   The between-friends ones (geliyom, di mi, napcan) are accepted when
   typed but never offered: an app that volunteers napcan to a learner
   about to meet a clerk has taught the form and not the language. */
const SP_SAY={"bir":"bi","burada":"burda","şurada":"şurda","orada":"orda","nerede":"nerde",
              "dakika":"dakka","buyurun":"buyrun"};
const SP_SAY2=[["ne","yapıyorsun","napıyorsun"],["bir","şey","bişey"],["hiçbir","şey","hiçbişey"],["ne","oldu","n'oldu"]];
const TR_VOW="aeıioöuü";
function spokenWord(w){
  let m;
  if((m=/^(.+)m(e|a)y(e|a)c(e|a)ğ(i|ı)m$/.exec(w)))return m[1]+"m"+(m[2]==="e"?"i":"ı")+"c"+m[4]+"m";
  if((m=/^(.*[^aeıioöuüy])(e|a)c(e|a)(ğim|ğım|ğiz|ğız|ksin|ksın|k)$/.exec(w))&&m[1].length>=2){
    const lv=(m[1].match(/[aeıioöuü]/g)||["e"]).pop();
    const v={a:"ı",ı:"ı",e:"i",i:"i",o:"u",u:"u",ö:"ü",ü:"ü"}[lv];
    const st=m[1]+v+"c"+m[3], e=m[4];
    /* 2nd person keeps its -sIn when offered: kalıcan is between friends.
       Bare -AcAk is never offered: it is also the participle and the noun,
       and gelecek ay (next month) is not said gelicek ay. */
    return e==="k"?null:e[0]==="k"?st+e:/m$/.test(e)?st+"m":st+"z";
  }
  return SP_SAY[w]||null;
}
/* The sentence as said, or null when nothing in it changes. Punctuation
   and a sentence-initial capital are kept where they were. */
function spokenOf(text){
  const raw=String(text).split(/\s+/).filter(Boolean);
  const parts=raw.map(function(r){
    const m=/^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u.exec(r);
    return m?{pre:m[1],core:m[2],post:m[3],low:trLower(m[2]),cap:m[2][0]!==trLower(m[2][0])}:{pre:r,core:"",post:"",low:"",cap:false};
  });
  const out=[]; let changed=false;
  for(let i=0;i<parts.length;i++){
    const p=parts[i], q=parts[i+1];
    /* şey keeps its endings: bir şeyi is bişeyi, bir şeyler bişeyler. */
    const two=q&&!p.post&&SP_SAY2.find(function(x){
      return x[0]===p.low&&(x[1]===q.low||(x[1]==="şey"&&q.low.indexOf("şey")===0));});
    if(two){
      let s=two[2]+q.low.slice(two[1].length); if(p.cap)s=capTR(s);
      out.push(p.pre+s+q.post); changed=true; i++; continue;
    }
    const sw=p.low?spokenWord(p.low):null;
    if(sw){out.push(p.pre+(p.cap?capTR(sw):sw)+p.post);changed=true;}
    else out.push(raw[i]);
  }
  return changed?out.join(" "):null;
}

/* The subject pronoun is optional — the ending already says who — so a
   sentence is right with it or without it. Only the personal pronouns
   whose person the verb shows are allowed to come and go: o and onlar
   are also "that" and "those", and dropping one of those changes the
   sentence. Never the last word (Bu kitap benim: mine IS the sentence),
   and never before de or ki (Ben de iyiyim: me too). Which pronouns may
   move at all is decided in one place, pronAgrees() below: a word it has
   no rule for never agrees, so it never comes or goes. */
const PRON_CLITIC=["de","da","ki","mi","mu"];
/* A genitive pronoun before a postposition is the postposition's, not an
   owner's: senin için, benim gibi. Dropping it leaves "for" with nothing. */
const PRON_POSTPOS=["icin","gibi","kadar","ile","hakkinda","yerine","disinda","yuzunden","sayesinde"];
function pronOptional(w,seq){
  const i=seq.indexOf(w);
  return i>-1&&i<seq.length-1&&
    PRON_CLITIC.indexOf(seq[i+1])<0&&PRON_POSTPOS.indexOf(seq[i+1])<0&&pronAgrees(w,seq);
}
/* Does the pronoun agree with the sentence it sits in? Ben needs the verb,
   which comes last, to end in -m, sen in -n, and so on; a possessive needs
   a word after it carrying the matching ending. This is what lets a
   pronoun come or go: when it agrees, the sentence already says who.
   When it does not — Ben çıkarken o giriyordu, where the verb is o's —
   the pronoun is carrying information and stays. */
function pronAgrees(p,seq){
  const i=seq.indexOf(p), after=seq.slice(i+1), last=seq[seq.length-1]||"";
  const any=function(re){return after.some(function(x){return re.test(x);});};
  const plural2=/(s|n)(i|u)n(i|u)z$/;
  if(p==="ben")return /m$/.test(last);
  if(p==="sen")return /n$/.test(last);
  if(p==="siz")return plural2.test(last);
  if(p==="biz")return /(z|k)$/.test(last)&&!plural2.test(last);
  if(p==="benim")return any(/m$/);
  if(p==="senin")return any(/n$/);
  if(p==="bizim")return any(/m(i|u)z$/);
  if(p==="sizin")return any(/n(i|u)z$/);
  return false;
}
/* One pronoun more or fewer than the model, and nothing else different:
   {k:"drop"} when the learner left it out, {k:"add"} when they put it in. */
function pronounSlack(model,typed){
  const M=dictTokens(model).map(function(t){return t.f;}), T=dictTokens(typed).map(function(t){return t.f;});
  const rest=T.slice(), miss=[];
  M.forEach(function(w){const i=rest.indexOf(w); if(i>-1)rest.splice(i,1); else miss.push(w);});
  if(miss.length===1&&!rest.length&&pronOptional(miss[0],M))return {k:"drop",w:miss[0]};
  if(rest.length===1&&!miss.length&&pronOptional(rest[0],T))return {k:"add",w:rest[0]};
  return null;
}
/* The model without its optional pronoun, as written, or null. */
function shortOf(model){
  const raw=String(model).split(/\s+/).filter(Boolean);
  const f=raw.map(function(r){return fold(r);});
  for(let i=0;i<raw.length;i++){
    if(pronOptional(f[i],f)){
      const out=raw.slice(0,i).concat(raw.slice(i+1));
      if(i===0&&out.length)out[0]=capTR(out[0]);
      return out.join(" ");
    }
  }
  return null;
}
