/* Sor: producing questions, which is the half of a conversation the
   course never drills. */

/* ===================== sor · asking ===================== */
/* Every mode in this app answers. Sixty units of reading, 432 sentences
   to produce, 330 prefabs — and almost none of it is a question. A
   learner who can only answer is a learner a conversation stops dead
   with, because the other person runs out of things to ask.

   Two shapes, and the second is the one that matters:

   1. **Evet/hayır** — turn a statement into a yes/no question. The
      particle is the whole difficulty: it is a separate word that takes
      the person onto itself (`geliyor musun`) except in the past, where
      the verb keeps it (`geldin mi`). That is a pattern you can be
      weak at, so it is keyed by tense.
   2. **Ne sordum?** — given a statement, produce the question that
      would have drawn it out. "Okula gidiyorum" is the answer to
      "Nereye gidiyorsun?", and finding that question is exactly the
      move a conversation needs.

   Both ride the Üretim runner, because prompt → silence → model →
   self-grade is already the right shape and the schedule is already
   keyed by pattern. Sor adds two banks, not a runner.

   The person shifts, which is the part learners get wrong: a statement
   in the first person is drawn out by a question in the second. Nobody
   asks "Nereye gidiyorum?" to elicit "Eve gidiyorum", and nobody asks
   a group "nereye gidiyor?" to be told "okula gidiyoruz" — ben and biz
   move to sen and siz, and the other three stand still. */
const ASK_P=[1,1,2,4,4,5];           /* statement person → question person */
const SOR_P=[0,2,3,5];               /* and the statements we generate */
/* Only the frames whose question is certain. bakmak and başlamak take a
   dative that is not a place, so "Nereye?" would be wrong for them and
   they are left to the other frames rather than guessed at. */
const SOR_FRAMES=["obj","dat","loc","bare","adj","gen"];

function sorAskable(f,s){
  if(f==="dat")return s.v&&s.v.prep==="to";
  return true;
}
function sorSpec(){
  for(let i=0;i<40;i++){
    const f=pick(SOR_FRAMES);
    const s=makeSpec(f);
    s.p=(f==="adj"||f==="gen")?2:pick(SOR_P);
    s.neg=false;                     /* "Nereye gitmiyorsun?" is not a question anyone asks */
    if(!sorAskable(f,s))continue;
    return s;
  }
  return null;
}
/* Lowercase the first letter of askEN's output so a question word can be
   put in front of it: "Are you coming?" → "Where are you going?" */
function unCap(s){return s.charAt(0).toLowerCase()+s.slice(1);}
/* English asks a subject question without do-support — "Who came?", not
   "Who did come?" — which is the opposite of every other wh-question and
   the thing learners over-correct. */
function whoEN(e,tense,neg){
  const [base,ger,past,s3]=e.e;
  if(tense==="prog")return "Who is"+(neg?" not ":" ")+ger+"?";
  if(tense==="past")return neg?"Who did not "+base+"?":"Who "+past+"?";
  if(tense==="fut")return "Who will"+(neg?" not ":" ")+base+"?";
  return neg?"Who does not "+base+"?":"Who "+s3+"?";
}
function sorAsk(s){
  const f=s.f, p=ASK_P[s.p];
  if(f==="adj")
    return {tr:capTR(s.n.t)+" nasıl?",en:"What is "+the(s.n)+" like?",qw:"nasıl"};
  if(f==="gen")
    return {tr:"Kimin "+nP3(s.n)+"?",en:"Whose "+s.n.en.split(",")[0].trim()+"?",qw:"kimin"};
  if(f==="bare")
    return {tr:"Kim "+conj(s.v,s.t,2,s.neg)+"?",en:whoEN(s.v,s.t,s.neg),qw:"kim"};
  const verb=conj(s.v,s.t,p,s.neg);
  if(f==="loc")
    return {tr:"Nerede "+verb+"?",en:"Where "+unCap(askEN(s.v,s.t,p,s.neg)),qw:"nerede"};
  if(f==="dat")
    return {tr:"Nereye "+verb+"?",en:"Where "+unCap(askEN(s.v,s.t,p,s.neg)),qw:"nereye"};
  /* obj: a thing is "Ne", a person is "Kimi" — and where English needs a
     preposition before the object it has to land at the end of the
     question: "Who are you waiting for?" */
  const who=!!s.n.who;
  const tail=s.v.oprep?" "+s.v.oprep+"?":"?";
  const body=unCap(askEN(s.v,s.t,p,s.neg)).replace(/\?$/,"")+tail;
  return {tr:(who?"Kimi ":"Ne ")+verb+"?",
          en:(who?"Who ":"What ")+body, qw:who?"kimi":"ne"};
}

/* --- the two banks --------------------------------------------------- */
/* Keyed by pattern, like the other generated drills: what comes back is
   the question you could not form, not the sentence you happened to get.
   "sor:" rather than "g:"/"t:" so a dump stays readable. */
function sorBank(){
  const out=[];
  for(let i=0;i<SESSION*3&&out.length<SESSION;i++){
    const s=sorSpec();
    if(!s)continue;
    const st=specText(s), q=sorAsk(s);
    if(!q.tr||!q.en)continue;
    out.push({k:"sor:"+s.f,tr:q.tr,en:q.en,lv:"Soru",from:q.qw,
              given:st.tr,instr:"Soruyu sor · ask the question this answers"});
  }
  return out;
}
function askBank(){
  const out=[];
  for(let i=0;i<SESSION*3&&out.length<SESSION;i++){
    const s=makeSpec(pick(["bare","obj","dat","loc"]));
    s.p=pick(SOR_P);s.neg=false;
    const st=specText(s);
    const to=Object.assign({},s,{f:"ask"});
    const q=specText(to);
    if(st.tr===q.tr)continue;
    const t=TENSES.filter(function(x){return x.k===s.t;})[0];
    out.push({k:"sor:mi:"+s.t,tr:q.tr,en:q.en,lv:"Soru",from:"mI · "+(t?t.tr:s.t),
              given:st.tr,instr:"Evet/hayır sorusu yap · make it a yes-no question"});
  }
  return out;
}

/* --- screen ----------------------------------------------------------- */
const SOR_WORDS=[["ne","what","Ne okuyorsun?"],["kim","who","Kim geldi?"],
                 ["kimi","who (object)","Kimi bekliyorsun?"],["nereye","where to","Nereye gidiyorsun?"],
                 ["nerede","where","Nerede oturuyorsun?"],["nasıl","how, what … like","Şehir nasıl?"],
                 ["kimin","whose","Kimin arabası?"]];
function renderSor(){
  let h=bar("Sor","asking · the other half",true,"soru sormak")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('Everything else in this app answers. Sixty units of reading, 432 sentences to produce, '+CHUNKS.length+' prefabs — and almost none of it is a question. A learner who can only answer is one a conversation stops dead with, because the other person runs out of things to ask.',
    'Uygulamanın geri kalanı hep cevap verir: altmış ünite, 432 cümle, '+CHUNKS.length+' kalıp, ve neredeyse hiçbiri soru değil. Yalnızca cevap verebilen biriyle konuşma bir yerde durur, çünkü karşıdakinin soracak şeyi biter.')+'</p>';

  h+='<h2 class="sec">Çalış</h2>';
  h+='<div class="card"><p class="lead">Ne sordum · ask the question</p>'+
   '<p class="sub">'+tx('A statement arrives and you produce the question that would have drawn it out. <i>Okula gidiyorum</i> answers <i>Nereye gidiyorsun?</i> — and note the person moves: nobody asks <i>Nereye gidiyorum?</i> to get that answer.',
     'Bir cümle gelir, sen o cevabı doğuracak soruyu kurarsın. <i>Okula gidiyorum</i>, <i>Nereye gidiyorsun?</i> sorusunun cevabıdır. Kişinin değiştiğine dikkat et: bu cevabı almak için kimse <i>Nereye gidiyorum?</i> diye sormaz.')+'</p>'+
   '<button class="btn" onclick="startProd(\'q\')">Başla</button></div>';
  h+='<div class="card"><p class="lead">Evet / hayır</p>'+
   '<p class="sub">'+tx('The same statement as a yes-no question. The particle is the whole difficulty: a separate word that takes the person onto itself — <i>geliyor musun</i> — except in the past, where the verb keeps it: <i>geldin mi</i>.',
     'Aynı cümle, evet/hayır sorusu olarak. Bütün zorluk soru ekinde: ayrı yazılır ve kişi ekini kendisi alır, <i>geliyor musun</i>; ama geçmiş zamanda kişi eki fiilde kalır, <i>geldin mi</i>.')+'</p>'+
   '<button class="btn" onclick="startProd(\'e\')">Başla</button></div>';

  h+='<h2 class="sec">Soru kelimeleri</h2><div class="card" style="padding:.3rem 1rem">';
  SOR_WORDS.forEach(function(w){
    h+='<div class="vrow">'+spkBtn(w[2],{aria:"Listen"})+
      '<div class="grow"><div class="vtr">'+esc(w[0])+' <span class="ven">· '+esc(w[1])+'</span></div>'+
      '<div class="ven" style="font-family:\'Crimson Pro\',serif;font-size:1rem">'+esc(w[2])+'</div></div></div>';
  });
  h+='</div>';
  h+='<p class="foot">'+tx('Questions are built fresh every time, so they cannot be recalled — only formed.<br>What comes back is the question word you were weak at, not a sentence you happened to miss.',
    'Sorular her seferinde yeniden kurulur; ezberden gelmez, kurulur.<br>Geri gelen, zayıf olduğun soru kelimesidir, kaçırdığın bir cümle değil.')+'</p></div>';
  paint(h);
}
