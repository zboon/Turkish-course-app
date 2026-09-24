/* Sık kelimeler: the most frequent words the units never teach, ten a day. */

/* ===================== sık kelimeler · the frequency layer ===================== */
/* The units choose their words for their passages, which is right for a
   reading course and left the everyday core full of holes: measured
   against spoken Turkish, the taught vocabulary covered well under the 95%
   of running speech that comprehension needs. SIK is the fill, in
   frequency order, and this is how it reaches the learner.

   It adds no queue. Introducing a word stars it, so the review ladder
   that already exists (S.star, S.srs, Sözlüğüm, the plan's Tekrar step)
   does every day after the first. S.sik only records which words have
   been met, so the next batch knows where to start:

     S.sik[word] = {d:day}        introduced and added to the reviews
     S.sik[word] = {d:day, k:1}   the learner already knew it; not starred

   Keyed by the word, never its index, so the list can be reordered or
   grown without re-pointing anyone. A word already starred some other way
   — added from Sözlük, or as one of the learner's own — counts as met.

   It deliberately does NOT feed Tekrar motoru, for the reason the
   learner's own words do not: that engine drills whatever the app's
   corpus mentions least, and these are by construction words the corpus
   barely mentions, so they would bury the course vocabulary it exists to
   rescue. The ordinary review queue is the right place for them. */
const SIK_DAY=10;
let SIKX={d:0,n:0};        /* extra batches asked for today; never stored */
function sikExtra(){return SIKX.d===dayNum()?SIKX.n:0;}
function sikMap(){if(!S.sik)S.sik={};return S.sik;}
function sikMet(e){return !!sikMap()[e[0]]||isStarred(e[0],e[1]);}
function sikAddedToday(){
  const t=dayNum(), m=sikMap();
  return Object.keys(m).filter(function(k){return m[k].d===t&&!m[k].k;}).length;
}
function sikRest(){return SIK.filter(function(e){return !sikMet(e);});}
/* Today's quota, less what was already added today — plus any extra ten
   the learner asked for. A word marked as known costs nothing. */
function sikLeft(){
  return Math.max(0,Math.min(SIK_DAY*(1+sikExtra())-sikAddedToday(),sikRest().length));
}
function sikBatch(){return sikRest().slice(0,sikLeft());}
/* The plan offers this only once a unit is finished: it needs nothing met,
   so on day one it would push the plan past one instruction. Araçlar has
   it from the start for anyone who goes looking. */
function sikAvail(){return Object.keys(S.done||{}).length>0&&sikRest().length>0;}
function sikKnow(t){
  const e=SIK.find(function(x){return x[0]===t;}); if(!e)return;
  sikMap()[t]={d:dayNum(),k:1};
  save();render();
}
/* First review tomorrow, not today: the word has just been read, and a
   box due today would un-tick the plan's own Tekrar step the moment this
   one was done. */
function sikAdd(){
  const b=sikBatch(); if(!b.length)return;
  const t=dayNum();
  b.forEach(function(e){
    setStar(e[0],e[1],true);
    S.srs[starKey(e[0],e[1])]={b:0,d:t+1};
    sikMap()[e[0]]={d:t};
  });
  save();render();
}
function sikMore(){SIKX={d:dayNum(),n:sikExtra()+1};render();}
function sikClass(e){
  if(/(mak|mek)$/.test(e[0]))return "f";
  return e[2]||(/\s/.test(e[0])?"i":"n");
}

function renderSik(){
  const b=sikBatch(), met=SIK.filter(sikMet).length, today=sikAddedToday();
  let h=bar("Sık kelimeler","the most common words",true,"en sık kelimeler")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('The units choose their words for their passages. These are the ones people actually say most that the units never teach — <i>çünkü</i>, <i>zaten</i>, <i>lazım</i> — in the order they are needed. Ten a day, then they come back in your reviews like any starred word.',
    'Üniteler kelimelerini metinlerine göre seçer. Bunlar insanların en çok kullandığı ama ünitelerin hiç öğretmediği kelimeler: <i>çünkü</i>, <i>zaten</i>, <i>lazım</i>; gerektikleri sırayla. Günde on tane; sonra her yıldızlı kelime gibi tekrarlarında geri gelirler.')+'</p>';
  h+=voiceNote();
  h+='<div class="stat"><div><b>'+met+'</b><span>tanıdık</span></div>'+
     '<div><b>'+SIK.length+'</b><span>listede</span></div>'+
     '<div><b>'+today+'</b><span>bugün</span></div></div>';
  if(!b.length){
    h+='<div class="card"><p class="lead">'+(sikRest().length?"Bugünlük bu kadar":"Hepsi bitti")+'</p>'+
     '<p class="sub">'+(sikRest().length
        ?tx('Today’s words are in your reviews and come back tomorrow. Ten a day is enough to keep; more is there if you want it.',
            'Bugünün kelimeleri tekrarlarında; yarın geri gelecekler. Günde on tane akılda tutmaya yeter; istersen daha fazlası var.')
        :tx('Every word on the list has been met. They live in your reviews now.','Listedeki her kelimeyi gördün. Artık tekrarlarında yaşıyorlar.'))+'</p>'+
     (sikRest().length?'<button class="btn ghost" onclick="sikMore()">Bir on daha · ten more</button>':'')+
     '<button class="btn" onclick="home()">Bugüne dön</button></div></div>';
    paint(h);return;
  }
  h+='<h2 class="sec">Bugün</h2><div class="card" style="padding:.3rem 1rem">';
  b.forEach(function(e){
    h+='<div class="vrow">'+spkBtn(e[0],{aria:"Listen"})+
      '<div class="grow"><div class="vtr">'+esc(e[0])+'</div><div class="ven">'+esc(e[1])+'</div></div>'+
      '<button class="sbtn" onclick="sikKnow(\''+jsq(e[0])+'\')">biliyorum</button></div>';
  });
  h+='</div>';
  h+='<button class="btn" onclick="sikAdd()">Tekrara ekle · add '+(b.length===1?"it":"these "+b.length)+' to my reviews</button>';
  h+='<p class="foot">'+tx('Tap a word to hear it. <b>biliyorum</b> skips one you already know and brings in the next.<br>First review tomorrow.',
    'Dinlemek için kelimeye dokun. <b>biliyorum</b>, bildiğin kelimeyi atlar ve sıradakini getirir.<br>İlk tekrar yarın.')+'</p></div>';
  paint(h);
}
