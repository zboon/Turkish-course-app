/* Atasözleri ve deyimler — the fixed figurative layer, drilled by
   production against an exact judge. */

/* ===================== söz · sayings ===================== */
/* The course teaches 600 content words out of literary passages, 330
   conversational prefabs, sixty grammar points, the numbers and a
   handful of service encounters. What it has never taught is the layer
   a Turkish speaker reaches for when they want to say something in one
   move: the proverb that settles an argument and the idiom that no
   amount of vocabulary will decode.

   Two reasons it belongs in a speaking course rather than a reading one:

   1. **It is fixed, so it is fast.** Everything else the learner
      produces has to be assembled — person, tense, case, the verb last —
      and assembly is slow while the grammar is still new. A proverb is
      one stored object. It is the highest fluency per unit of memory in
      the language, which is exactly what a slow speaker needs.
   2. **An idiom is non-compositional, and nothing else here tests
      that.** "kafa patlatmak" is not "to burst a head". A learner who
      knows every word in it still fails, and no amount of the course's
      own vocabulary drilling would ever surface the problem.

   THE PROMPT IS THE SITUATION, NOT THE GLOSS
   For a proverb, knowing the words is not the skill — knowing the
   moment is. One produced at the wrong moment is worse than silence, so
   the learner is given the moment and produces the saying. Reversing
   that would drill recognition, which is what the app already has too
   much of.

   THE JUDGE IS EXACT, AND THAT IS THE POINT
   This is the app's THIRD objective judge, after Dikte and Sayılar'ın
   Duy'u, and it has the strictest bar of the three — stricter even than
   Dilbilgisi's every-word rule, because order counts too:

     Dikte            80% of the words, nothing invented   (dictPass)
     Dilbilgisi       every word, any order                (gramJudge)
     Söz              every word, in order                 (ataJudge)

   A proverb is a fixed string. "Damlaya damlaya göl olur" with one word
   wrong is not a proverb slightly misremembered, it is a sentence
   nobody says — and a self-graded "close enough" would wave through
   exactly the thing this mode exists to prevent. So the verdict is
   dictScore's `clean`: every word present, in sequence, nothing extra.
   Diacritics are still forgiven, like everywhere else.

   WHAT SAVES IT FROM BEING UNFAIR
   A fixed form is not always a single form. Where a saying genuinely
   has more than one real wording the entry lists them in `alt`, the
   judge takes whichever the learner's answer scores best against, and
   a right answer shows the others. Beyond that the learner can overrule
   the mark, exactly as in Dilbilgisi and for the same reason: the list
   of variants is as good as the person who wrote it, and a learner who
   met a regional wording in the street is not wrong because this bank
   has not heard of it. */

const ATA_SESSION=8;

/* Keyed by a slug, not a position. CHUNKS keys "k:<index>" and is
   therefore append-only for ever; keying these "a:<id>"/"d:<id>" means
   the bank can be reordered and regrouped without re-pointing a single
   saved box. Same permanence rule though: an id, once shipped, is as
   fixed as a unit id. */
function ataBox(k){const r=S.ata&&S.ata[k];return r?r.b:-1;}
function ataGrade(k,good){
  if(!S.ata)S.ata={};
  bump(S.ata,k,function(b){return good?b+1:0;});
  save();
}
/* The learner overrules. Replaces the grade just written rather than
   stacking on it, from the box the saying was on BEFORE the miss. */
function ataAcceptKey(k,pre){
  if(!S.ata)S.ata={};
  bump(S.ata,k,function(){return (pre<0?0:pre)+1;});
  save();
}

function ataForms(it){return [it.c].concat(it.alt||[]);}
/* Score against every accepted wording and keep the best, so the marked
   line names words against the variant the learner was actually aiming
   at rather than against an arbitrary first entry. */
function ataJudge(it,typed){
  let best=null;
  ataForms(it).forEach(function(f){
    const r=dictScore(f,typed); r.model=f;
    if(!best){best=r;return;}
    if(r.clean&&!best.clean){best=r;return;}
    if(!best.clean&&r.hit>best.hit)best=r;
  });
  return best;
}

/* --- the two banks ---------------------------------------------------- */
function ataItem(p){
  return {k:"a:"+p.id,kind:"a",id:p.id,q:p.s,c:p.t,en:p.en,eq:p.eq||"",
          alt:p.alt||[],from:"Atasözü · proverb"};
}
function deyimItem(d){
  return {k:"d:"+d.id,kind:"d",id:d.id,q:d.en,c:d.t,lit:d.lit,ex:d.ex,
          alt:[],from:"Deyim · idiom"};
}
function ataBank(mode){
  const a=ATASOZU.map(ataItem), d=DEYIM.map(deyimItem);
  return mode==="a"?a:mode==="d"?d:a.concat(d);
}
function ataDue(mode){
  return ataBank(mode).filter(function(it){return isDue(S.ata,it.k);});
}

/* --- the run ---------------------------------------------------------- */
let AT=null;
function startAta(mode){
  stopPlay();
  const q=dueQueue(S.ata,ataBank(mode),ATA_SESSION);
  if(!q.length){V={view:"ata"};render();return;}
  AT={mode:mode,q:q,i:0,phase:"ask",typed:"",res:null,right:0,pre:-1,over:false};
  V={view:"atarun"};window.scrollTo(0,0);
  touchDay();render();
}
function ataKeep(){
  const box=document.getElementById("abox");
  if(box&&AT)AT.typed=box.value;
}
function ataCheck(){
  if(!AT)return;
  const it=AT.q[AT.i]; if(!it)return;
  ataKeep();
  AT.pre=ataBox(it.k);
  AT.over=false;
  AT.res=ataJudge(it,AT.typed);
  ataGrade(it.k,AT.res.clean);
  if(AT.res.clean)AT.right++;
  else errNote(it.k,{m:"z",q:it.q,c:it.c,a:AT.typed,
                     w:it.kind==="a"?it.en:it.lit,to:""});
  AT.phase="check";render();
}
function ataAccept(){
  if(!AT||AT.phase!=="check"||AT.res.clean||AT.over)return;
  const it=AT.q[AT.i];
  ataAcceptKey(it.k,AT.pre);
  /* Overruled is not missed — the entry the mark just wrote comes back
     out, or the book records a mistake the learner did not make. */
  errForget2(it.k);
  AT.over=true;AT.right++;render();
}
function ataSay(){const it=AT&&AT.q[AT.i];if(it)say(it.c);}
function ataSayEx(){const it=AT&&AT.q[AT.i];if(it&&it.ex)say(it.ex[0]);}
function ataNext(){
  if(!AT)return;
  AT.i++;AT.typed="";AT.res=null;AT.over=false;AT.pre=-1;AT.phase="ask";
  window.scrollTo(0,0);
  if(AT.i>=AT.q.length)AT.phase="end";
  render();
}

/* --- screens ----------------------------------------------------------- */
function renderAta(){
  const all=ataBank("x"), firm=all.filter(function(it){return ataBox(it.k)>=4;}).length;
  const dueA=ataDue("a").length, dueD=ataDue("d").length;
  let h=bar("Atasözleri ve deyimler","sayings · said whole, not assembled",true,"bütün olarak söylenen sözler")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('Everything else you produce here has to be built — person, tense, case, the verb last — and building is slow while the grammar is new. These are stored whole and come out at full speed, which is exactly what a slow speaker needs. They are also anonymous folk material, so unlike the reading passages there is no author to credit and no edition to check.',
    'Burada söylediğin başka her şeyi kurman gerekir: kişi, zaman, hâl, en sonda fiil; dilbilgisi yeniyken kurmak yavaştır. Bunlar ise bütün olarak saklanır ve tam hızla çıkar; yavaş konuşan birinin tam da ihtiyacı olan şey. Ayrıca anonim halk sözleridir: okuma metinlerinin aksine anılacak bir yazar ya da kontrol edilecek bir baskı yok.')+'</p>';

  h+='<div class="stat"><div><b>'+ATASOZU.length+'</b><span>atasözü</span></div>'+
     '<div><b>'+DEYIM.length+'</b><span>deyim</span></div>'+
     '<div><b>'+firm+'</b><span>'+tx('holding','oturmuş')+'</span></div></div>';

  h+='<h2 class="sec">Çalış</h2>';
  h+='<div class="card"><p class="lead">Atasözleri · '+dueA+' hazır</p>'+
   '<p class="sub">'+tx('A situation comes up and you produce the saying that answers it. Knowing the words is not the skill — knowing the <i>moment</i> is, because a proverb said at the wrong one is worse than saying nothing.',
     'Bir durum gelir, sen ona uyan sözü söylersin. Beceri kelimeleri bilmek değil, <i>anı</i> bilmektir; yanlış anda söylenen bir atasözü hiç söylememekten kötüdür.')+'</p>'+
   (dueA?'<button class="btn" onclick="startAta(\'a\')">Başla</button>'
        :'<p class="tiny">'+tx('Nothing due. They come back as their boxes come round.','Şimdilik bekleyen yok. Sırası gelince geri gelirler.')+'</p>')+'</div>';
  h+='<div class="card"><p class="lead">Deyimler · '+dueD+' hazır</p>'+
   '<p class="sub">'+tx('English meaning in, Turkish idiom out. What the words literally say is shown after you answer, not before — <i>kafa patlatmak</i> is not "to burst a head", and that gap is the whole reason an idiom has to be learned as one piece.',
     'İngilizce anlamı gelir, sen Türkçe deyimi söylersin. Kelimelerin tam olarak ne dediği cevaptan sonra gösterilir, önce değil: <i>kafa patlatmak</i> “bir kafayı patlatmak” değildir ve bir deyimin tek parça öğrenilmesinin nedeni bu farktır.')+'</p>'+
   (dueD?'<button class="btn" onclick="startAta(\'d\')">Başla</button>'
        :'<p class="tiny">'+tx('Nothing due yet.','Henüz bekleyen yok.')+'</p>')+'</div>';

  h+='<h2 class="sec">Nasıl işaretlenir</h2><div class="card">'+
   '<p class="sub">'+tx('Every word, in order, nothing extra. This is the strictest judge in the app and deliberately so: a fixed saying with one word wrong is not a saying slightly misremembered, it is a sentence nobody says. Diacritics are forgiven as everywhere else, and where a saying genuinely has more than one real wording both are accepted — you will see the other after a right answer. If you know a wording this list does not, you can overrule the mark.',
     'Her kelime, sırasıyla, fazlası olmadan. Uygulamanın en sıkı değerlendirmesi bu ve bilerek öyle: bir kelimesi yanlış kalıplaşmış bir söz, biraz yanlış hatırlanmış bir söz değil, kimsenin söylemediği bir cümledir. Şapkalı ve noktalı harfler her yerdeki gibi önemsenmez. Bir sözün gerçekten birden çok söylenişi varsa hepsi kabul edilir; doğru cevaptan sonra ötekini görürsün. Bu listede olmayan bir söyleniş biliyorsan değerlendirmeyi değiştirebilirsin.')+'</p></div>';

  h+='<p class="foot">'+tx('Anonymous folk material — no author, no edition, nothing to attribute.<br>Scheduled by saying, on the same ladder as everything else.',
    'Anonim halk sözleri: yazarı, baskısı, anılacak kimsesi yok.<br>Her söz, öteki her şeyle aynı merdivende sıraya konur.')+'</p></div>';
  paint(h);
}

function renderAtaRun(){
  if(!AT){renderAta();return;}
  if(AT.phase==="end"){
    paint(bar("Söz","Bitti",true)+'<div class="wrap"><div class="score">'+
      '<div class="big '+(AT.right*2>=AT.q.length?"pass":"fail")+'">'+AT.right+'/'+AT.q.length+'</div>'+
      '<p class="sub">tam çıktı · produced exactly</p></div>'+
      '<div class="card"><p class="sub">'+tx('Anything missed comes back today, the rest moves out a box. A near miss counts as a miss here — the form is the whole thing.',
        'Yanlış yapılanlar bugün yeniden gelir, ötekiler bir kutu ileri gider. Burada “az kaldı” da yanlış sayılır; her şey biçimde.')+'</p>'+
      '<button class="btn" onclick="startAta(\''+AT.mode+'\')">Devam</button>'+
      '<button class="btn ghost" onclick="go(\'ata\')">Atasözleri ve deyimler</button></div></div>');
    return;
  }
  const it=AT.q[AT.i];
  let h=bar("Söz",(AT.i+1)+" / "+AT.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+AT.q.map(function(_,i){
    return '<i class="'+(i<AT.i?(AT.res&&!AT.res.clean&&!AT.over&&i===AT.i-1?"no":"ok"):"")+'"></i>';
  }).join('')+'</div>';
  h+='<p class="qn">'+esc(it.kind==="a"?"Ne dersin? · what do you say?":"Hangi deyim? · which idiom?")+'</p>';
  h+='<p class="q">'+esc(it.q)+'</p>';

  if(AT.phase==="ask"){
    h+='<input class="inp" id="abox" autocapitalize="off" autocomplete="off" autocorrect="off" '+
     'spellcheck="false" placeholder="Türkçe yaz…" value="'+esc(AT.typed||"")+'">'+
     '<button class="btn" onclick="ataCheck()">Kontrol et</button>';
  }else{
    const r=AT.res, won=r.clean||AT.over;
    h+='<div class="card"><p class="dline">'+r.ops.map(function(o){
      return '<span class="dw '+(o.t==="ok"?"":o.t)+'">'+esc(o.w)+'</span>';
    }).join(" ")+'</p>';
    /* The payoff, and it is deliberately after the answer: for a proverb
       what it literally says, for an idiom the picture behind it and a
       sentence with it in place. */
    if(it.kind==="a"){
      h+='<p class="sub" style="margin-top:.6rem">'+esc(it.en)+
        (it.eq?' <i>· '+esc(it.eq)+'</i>':'')+'</p>';
    }else{
      h+='<p class="sub" style="margin-top:.6rem">kelimesi kelimesine · '+esc(it.lit)+'</p>';
      if(it.ex)h+='<p class="sub" style="font-family:\'Crimson Pro\',serif;font-size:1.02rem">'+
        esc(it.ex[0])+'<br><span class="ven">'+esc(it.ex[1])+'</span></p>';
    }
    h+='<button class="sbtn" style="margin-top:.4rem" onclick="ataSay()">'+IC.spk+' dinle</button>';
    if(it.ex)h+=' <button class="sbtn" style="margin-top:.4rem" onclick="ataSayEx()">'+IC.spk+' örnek</button>';
    h+='</div>';
    h+='<div class="fb '+(won?"ok":"no")+'"><b>'+
     (AT.over&&!r.clean?"Kabul edildi":r.clean?"Tam":r.hit+" / "+r.of+" kelime")+'</b>'+
     (AT.over&&!r.clean?tx("Taken as right. It moves out a box.","Doğru kabul edildi. Bir kutu ileri gider.")
      :r.clean?((it.alt&&it.alt.length)
                 ?tx("Also said: "+it.alt.map(esc).join(" · ")+". Both are real; you will meet either.","Şöyle de söylenir: "+it.alt.map(esc).join(" · ")+". İkisi de gerçek; hangisiyle de karşılaşabilirsin.")
                 :tx("It comes back later and later from here.","Bundan sonra gittikçe daha geç gelecek."))
              :tx("Red is what the saying has and you did not. A fixed form is the whole point, so this counts as a miss and comes back today.",
                  "Kırmızılar sözde var, sende yok. Bütün mesele kalıbın kendisi; bu yüzden yanlış sayılır ve bugün yeniden gelir."))+'</div>';
    if(!won)h+='<button class="btn ghost" onclick="ataAccept()">Benimki de söyleniyor · mine is said too</button>';
    h+='<button class="btn" onclick="ataNext()">'+(AT.i+1>=AT.q.length?"Sonuç":"Devam")+'</button>';
  }
  h+='<p class="tiny" style="text-align:center;margin-top:.7rem">'+esc(it.from)+'</p></div>';
  paint(h);
  const box=document.getElementById("abox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")ataCheck();});
  }
}
