/* İlerleme: where the learner stands, in one place. */

/* ===================== ilerleme · progress ===================== */
/* The end of a sitting used to carry the state of its whole mode — how
   many words were still under eight encounters, how many lines were left
   in the set — which a learner meets several times a day and reads once.
   That belongs here instead, where it is looked for, and a sitting ends
   on its score and the way on (endScreen, app.tekrar.js).

   Nothing here is stored or kept in step by hand. Every number is read
   off the same banks and schedules the modes use themselves, at the
   moment the page is drawn, so it cannot disagree with them. "Çalışılan"
   means an item has a schedule record, i.e. it has been practised at
   least once; "oturmuş" means it has reached box 4, about a week out,
   which is the same line Dilbilgisi tekrarı has always called holding. */
const IL_FIRM=4;

/* One row: a label with its English underneath, a count, and a meter
   when the count is out of something. The English is written as a .gl
   span, the way a tab carries its own, so the EN toggle reaches it. */
function ilRow(tr,en,n,of){
  const pct=of?Math.min(100,Math.round(100*n/of)):0;
  return '<div class="prow"><div class="row"><span class="grow">'+esc(tr)+'<span class="gl">'+esc(en)+'</span></span>'+
    '<b>'+n+(of?' / '+of:'')+'</b></div>'+(of?'<div class="meter"><i style="width:'+pct+'%"></i></div>':'')+'</div>';
}
/* Records in a schedule map, optionally under one key prefix, and how
   many of them have reached a given box. */
function ilCount(map,pfx,box){
  let n=0;
  if(map)for(const k in map)if((!pfx||k.indexOf(pfx)===0)&&(box===undefined||(map[k]&&map[k].b>=box)))n++;
  return n;
}
/* How often each taught word is met — the one number Tekrar motoru
   exists to move. It lived on that mode's hub; it is progress, not a way
   in, so it lives here. */
function repChart(){
  const b=repBands(), max=Math.max.apply(null,b)||1;
  const bands=[["1","met once"],["2–3","thin"],["4–7","getting there"],["8–20","durable"],["21+","embedded"]];
  let h='<p class="sub" style="margin:.1rem 0 .6rem">'+tx('How many times each word you have met is met again — the app’s own material plus the drills. Eight is roughly where a word starts to stay.',
    'Gördüğün her kelimeyle kaç kez karşılaşıldığı: uygulamanın kendi metinleri ve alıştırmalar birlikte. Bir kelime aşağı yukarı sekizinci karşılaşmada akılda kalmaya başlar.')+'</p>';
  bands.forEach(function(band,i){
    const pct=Math.round(100*b[i]/max);
    h+='<div style="display:flex;align-items:center;gap:.6rem;margin:.35rem 0">'+
      '<span class="tiny" style="width:3.2rem;text-align:right;flex:0 0 auto">'+band[0]+'</span>'+
      '<span style="flex:1;height:14px;background:var(--sunk);border-radius:99px;overflow:hidden">'+
      '<span style="display:block;height:100%;width:'+pct+'%;border-radius:99px;background:'+
      (i>=3?"var(--turk)":i===2?"var(--gold)":"var(--bole)")+'"></span></span>'+
      '<span class="tiny" style="width:5.5rem;flex:0 0 auto">'+b[i]+' · '+band[1]+'</span></div>';
  });
  return h+'<p class="tiny" style="margin-top:.6rem">'+tx('Red is a word met and then left. The aim is to move the top two rows into the bottom two.',
    'Kırmızı, bir kez görülüp bırakılan kelimedir. Amaç üstteki iki satırı alttaki ikisine taşımak.')+'</p>';
}
function renderIlerleme(){
  const done=UNITS.filter(u=>isDone(u.id)).length;
  let h=bar("İlerleme","progress",true,"nerede olduğun")+'<div class="wrap">';
  h+='<div class="stat"><div><b>'+done+'</b><span>'+tx("units done","biten ünite")+'</span></div>'+
     '<div><b>'+streak()+'</b><span>'+tx("day streak","gün üst üste")+'</span></div>'+
     '<div><b>'+S.star.length+'</b><span>'+tx("saved words","kayıtlı kelime")+'</span></div></div>';

  /* Today's plan, step by step: the landing page shows only its first. */
  const plan=planToday();
  if(plan.steps.length)h+='<h2 class="sec">Bugün</h2><div class="card" style="padding:.2rem 1rem">'+planRows(plan)+'</div>';

  h+='<h2 class="sec">Kurs</h2><div class="card">'+
    ilRow("Başlarken","the lessons before unit one",baslaCount(),BASLA.length);
  LEVELS.forEach(function(l){h+=ilRow(l.id+" · "+l.tr,l.en,lvDone(l.id),unitsOf(l.id).length);});
  h+='</div>';

  /* Words: the course's own, the frequency layer, and the learner's. */
  const met=repBank(), short=repShort().length;
  h+='<h2 class="sec">Kelimeler</h2><div class="card">'+
    ilRow("Görülen kelimeler","course words met",met.length,repAll())+
    ilRow("Sekiz kez geçenler","met eight times or more",met.length-short,met.length)+
    ilRow("Sık kelimeler","common words taken in",SIK.filter(sikMet).length,SIK.length)+
    ilRow("Bugün tekrar bekleyen","saved words due today",dueList().length)+
    ilRow("Kendi kelimelerim","words you added",(S.mine||[]).length)+'</div>';
  if(met.length)h+='<div class="card">'+repChart()+'</div>';

  const gb=gramBank();
  h+='<h2 class="sec">Dilbilgisi</h2><div class="card">'+
    ilRow("Okunan konular","grammar points read",gb.length,UNITS.length)+
    ilRow("Oturmuş konular","points holding, a week out or more",gb.filter(function(it){return gramBox(it.k)>=IL_FIRM;}).length,gb.length)+'</div>';

  const lines=UNITS.reduce(function(n,u){return n+u.read.lines.length;},0);
  const told=UNITS.filter(function(u){const r=S.retell&&S.retell[u.id];return r&&r.n>=3;}).length;
  const talked=DIYALOG.filter(function(s){return S.dia&&S.dia[s.id]&&S.dia[s.id].n;}).length;
  h+='<h2 class="sec">Konuşma</h2><div class="card">'+
    ilRow("Söylenen cümleler","passage lines produced",ilCount(S.prod,"s:"),lines)+
    ilRow("Kalıplar","set phrases worked through",ilCount(S.prod,"k:"),CHUNKS.length)+
    ilRow("Üç kez anlatılan","speaking tasks told three times",told)+
    ilRow("Diyaloglar","conversations finished",talked,DIYALOG.length)+
    ilRow("Atasözleri ve deyimler","sayings holding",ilCount(S.ata,"",IL_FIRM),ATASOZU.length+DEYIM.length)+'</div>';

  h+='<h2 class="sec">Dinleme</h2><div class="card">'+
    ilRow("Dikte","lines written from hearing",ilCount(S.dinle,"d:"),lines)+
    ilRow("Ses önce","lines understood with no text",ilCount(S.dinle,"a:"),lines)+
    ilRow("Sayılar","number shapes holding",ilCount(S.num,"",IL_FIRM),NUM_BANDS.length*2)+'</div>';

  const errs=Object.keys(S.err||{}).length, rep=errRepeat().length;
  h+='<h2 class="sec">Hatalar</h2><div class="card">'+
    ilRow("Defterdeki hatalar","mistakes in the book",errs)+
    ilRow("Tekrarlayanlar","caught you twice or more",rep)+
    (errs?'<button class="btn ghost" onclick="go(\'hata\')">Hata defterini aç</button>':'')+'</div>';

  h+='<p class="foot">'+tx('Everything here is counted from your own schedules as the page opens.<br>Nothing on it has to be done.',
    'Buradaki her sayı, sayfa açılırken kendi tekrar takviminden sayılır.<br>Burada yapılması gereken bir şey yok.')+'</p></div>';
  paint(h);
}
