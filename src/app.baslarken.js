/* Başlarken: six short lessons before unit one, for someone who has
   never seen Turkish written down. The letters and what they sound like,
   spelling as sound, stress, words built from pieces, the order of a
   sentence against English, and sen/siz with a first handful of phrases.

   It sits beside the sixty units rather than among them. A unit id is
   permanent and every schedule in the app is keyed to one, so the intro
   is not a unit: it has its own list (BASLA), its own record (S.basla,
   keyed by lesson id and as permanent as a unit id), and it feeds no
   review. Nothing reviews what has not been met, and nothing here is
   material to review — it is orientation, and a lesson is ticked by
   passing its few questions, the same four-in-five bar as a unit.

   The lessons open in order, and unit one opens only when all six are
   passed (unitOpen() in app.core.js). Nothing has to be sat through:
   a lesson's questions can be taken without reading it, and the A1 test
   ahead skips the lessons and A1 together. Bugün points at the next
   lesson while no unit has been opened; a learner whose progress
   predates the lock keeps every unit already opened, the plan follows
   the units, and the intro sits below the levels as reference. */

/* ===================== başlarken ===================== */
/* Where "start" goes now: the first unit that is open and not passed,
   or the next intro lesson while unit one is still locked. */
function startBtn(cls){
  const nx=UNITS.find(function(u){return !isDone(u.id)&&unitOpen(u.id);});
  if(nx)return '<button class="'+cls+'" onclick="go(\'unit\',\''+nx.id+'\',\'v\')">'+esc(nx.lv+" · "+nx.tr)+' ile başla</button>';
  const b=baslaNext();
  if(b)return '<button class="'+cls+'" onclick="go(\'basla\',\''+b.id+'\')">Giriş derslerine başla</button>';
  return '';
}
/* A locked unit says what opens it and how to skip ahead. */
function lockCard(u){
  const k=unitKey(u.id);
  const why=k?"Units open in order, so each one builds on the last. This one opens when you pass the unit before it, "+esc(k.lv+" · "+k.tr)+" (unit "+k.n+")."
             :"Unit one opens once the six lessons in Başlarken are passed: the letters, the sounds and how a sentence is built.";
  return '<div class="card"><p class="lead">Kilitli</p>'+
    '<p class="sub">'+why+' To skip ahead, pass the '+u.lv+' level test: eight out of ten marks every unit in '+u.lv+' complete.</p>'+
    startBtn("btn")+
    '<button class="btn ghost" onclick="startLevelExam(\''+u.lv+'\')">İleri test</button></div>';
}
function baslaIdx(id){return BASLA.findIndex(function(l){return l.id===id;});}
function baslaDone(id){return !!(S.basla&&S.basla[id]);}
function baslaCount(){return BASLA.filter(function(l){return baslaDone(l.id);}).length;}
function baslaNext(){return BASLA.find(function(l){return !baslaDone(l.id);})||null;}
/* The lesson Bugün offers, or null. Only before any unit has been opened:
   once one has, the learner has chosen where to start. */
function baslaPlan(){return metUnits().length===0?baslaNext():null;}
/* A question that has to be heard is left out where nothing can be heard:
   with no speech engine at all it would be a guess between spellings. */
function baslaItems(L){
  const mute=voiceState()==="none";
  return L.check.filter(function(it){return !(mute&&it.say);});
}

function renderBaslarken(){
  const nd=baslaCount(), nx=nextUnit();
  let h=bar("Giriş dersleri","before unit one · "+nd+" / "+BASLA.length,true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">Six short lessons for a complete beginner: how the letters sound, how words are spelt and stressed, how they are built, and how a sentence is put together. Each ends in a few questions, and each opens when the one before it is passed. Unit one opens when all six are. If you can already read Turkish, take the questions at the end of each lesson straight away, or pass the A1 test in Dersler to skip the lessons and A1 together.</p>';
  h+='<div class="meter" style="margin-bottom:1.2rem"><i style="width:'+Math.round(100*nd/BASLA.length)+'%"></i></div>';
  h+='<div class="card" style="padding:.2rem 1rem">';
  const here=baslaNext();
  BASLA.forEach(function(L,i){
    const d=baslaDone(L.id), open=baslaOpen(L.id);
    h+='<button class="unit'+(open?'':' locked')+'" onclick="go(\'basla\',\''+L.id+'\')">'+
      '<span class="tick '+(d?"done":(L===here?"here":""))+'">'+(d?IC.check:(open?(i+1):IC.lock))+'</span>'+
      '<span class="grow"><span class="unit-t">'+esc(L.tr)+'</span>'+
      '<span class="unit-s">'+esc(L.en)+' · '+baslaItems(L).length+' soru</span></span>'+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  h+='</div>';
  if(nx&&unitOpen(nx.id))h+='<button class="btn ghost" onclick="go(\'unit\',\''+nx.id+'\',\'v\')">'+esc(nx.lv+" · "+nx.tr)+' ile başla</button>';
  h+='</div>';
  paint(h);
}

/* A row to hear. A letter row leads with the letter; every row plays its
   Turkish word, and the hint (a sound, a syllable split, the pieces) sits
   under the English. The hint is not an interface label, so it is not in
   a class the English pass reads. */
function baslaRow(tr,en,hint,letter){
  return '<div class="vrow">'+(letter?'<span class="bl">'+esc(letter)+'</span>':'')+spkBtn(tr,{aria:"Listen"})+
    '<div class="grow"><div class="vtr">'+esc(tr)+'</div>'+
    (en?'<div class="ven">'+esc(en)+'</div>':'')+
    (hint?'<div class="hint">'+esc(hint)+'</div>':'')+'</div></div>';
}
function renderBasla(){
  const i=baslaIdx(V.u);
  if(i<0){V={view:"baslarken"};renderBaslarken();return;}
  const L=BASLA[i], nb=BASLA[i+1], items=baslaItems(L);
  let h=bar(L.tr,"Giriş "+(i+1)+" / "+BASLA.length+" · "+L.en,true)+'<div class="wrap">';
  if(!baslaOpen(L.id)){
    const pb=BASLA[i-1];
    paint(h+'<div class="card"><p class="lead">Kilitli</p><p class="sub">The lessons open in order. This one opens when you pass '+esc(pb.tr+" · "+pb.en)+'.</p>'+
      '<button class="btn" onclick="go(\'basla\',\''+baslaNext().id+'\')">'+esc(baslaNext().tr)+' ile başla</button></div></div>');
    return;
  }
  h+=voiceNote();
  h+='<div class="card gram"><p>'+L.intro+'</p></div>';
  L.parts.forEach(function(pt){
    h+='<h2 class="sec">'+esc(pt.h)+'<span class="gl">'+esc(pt.en)+'</span></h2><div class="card gram">';
    (pt.p||[]).forEach(function(x){h+='<p>'+x+'</p>';});
    (pt.letters||[]).forEach(function(r){h+=baslaRow(r[1],r[2],r[3],r[0]);});
    (pt.rows||[]).forEach(function(r){h+=baslaRow(r[0],r[1],r[2]);});
    h+='</div>';
  });
  h+='<h2 class="sec">Alıştırma</h2>';
  if(baslaDone(L.id))h+='<div class="card" style="border-color:var(--turk)"><p class="lead">Tamamlandı</p><p class="sub">You can run the questions again any time.</p></div>';
  h+='<div class="card"><p class="lead">'+items.length+' soru</p>'+
    '<p class="sub">Answer '+Math.ceil(items.length*0.8)+' or more correctly to tick this lesson. Nothing here is scheduled for review.</p>'+
    '<button class="btn" onclick="startBasla(\''+L.id+'\')">Başla</button></div>';
  /* Onward only once this lesson is passed: the next one is locked until then. */
  if(baslaDone(L.id)){
    if(nb)h+='<button class="btn ghost" onclick="go(\'basla\',\''+nb.id+'\')">Sonraki ders →</button>';
    else{const nx=nextUnit(); if(nx&&unitOpen(nx.id))h+='<button class="btn ghost" onclick="go(\'unit\',\''+nx.id+'\',\'v\')">'+esc(nx.lv+" · "+nx.tr)+' ile başla</button>';}
  }
  h+='</div>';
  paint(h);
}
function startBasla(id){
  const L=BASLA[baslaIdx(id)];
  const items=baslaItems(L).map(function(it){return Object.assign({},it);});
  Q={mode:"intro",b:id,items:items,i:0,res:[],sel:null,built:[],title:L.tr,
     pass:Math.ceil(items.length*0.8),heard:{}};
  V={view:"quiz"}; window.scrollTo(0,0); render();
}
/* The score screen's half for the intro, called from renderScore(). */
function baslaScore(n,of){
  const pass=n>=Q.pass, i=baslaIdx(Q.b), nb=BASLA[i+1], nx=nextUnit();
  if(pass&&!baslaDone(Q.b)){S.basla[Q.b]={at:Date.now()};save();}
  let h='<div class="score"><div class="big '+(pass?"pass":"fail")+'">'+n+'/'+of+'</div>'+
    '<p class="sub">'+(pass?"Geçtiniz":"Biraz daha çalışmak gerek")+'</p></div>';
  h+='<div class="card"><p class="sub">'+
    (pass?(nb?"Lesson ticked. Next: "+esc(nb.en)+".":"That is the whole introduction. Unit one starts with greetings and the endings for I am and you are.")
         :"You need "+Q.pass+" to pass. Read the lesson again and have another go. Nothing here counts against you.")+'</p>';
  if(pass&&nb)h+='<button class="btn" onclick="go(\'basla\',\''+nb.id+'\')">Sonraki ders →</button>';
  else if(pass&&nx&&unitOpen(nx.id))h+='<button class="btn" onclick="go(\'unit\',\''+nx.id+'\',\'v\')">'+esc(nx.lv+" · "+nx.tr)+' ile başla</button>';
  else if(!pass)h+='<button class="btn" onclick="startBasla(\''+Q.b+'\')">Tekrar dene</button>';
  h+='<button class="btn ghost" onclick="go(\'basla\',\''+Q.b+'\')">Derse dön</button></div>';
  return h;
}
