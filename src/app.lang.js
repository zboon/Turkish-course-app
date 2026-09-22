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
