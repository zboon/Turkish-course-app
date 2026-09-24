/* Adacıklar: language islands, the learner's own Turkish about their own
   life, written, checked by a person, then drilled until it comes out
   whole. */

/* ===================== ada · language islands ===================== */
/* Everything else in this app is the course's Turkish. A learner who
   can say the course's sentences still stalls at the first thing a
   Turkish speaker actually asks, which is about them: where are you
   from, what do you do, what did you do at the weekend. Polyglots
   prepare those answers on purpose: a few sentences on each topic of
   their own life, corrected by a native speaker and rehearsed until they
   come out without assembly. Those prepared patches are the "islands",
   and a conversation is stepping from one to the next.

   So this mode asks questions (ADA, in Turkish, each in the grammar of
   one unit and open once that grammar is read), and the learner answers
   about themselves, a few sentences a day.

   THE CHECK IS A PERSON, AND THAT IS DELIBERATE
   Nothing here can mark free writing. The app's judges compare an
   answer with a known one, and a sentence about the learner's own life
   has no known answer. Drilling an unchecked sentence would rehearse
   its mistakes into a fixed form, which is the worst thing a drill can
   do. So a sentence waits as "kontrol bekliyor" until it is checked:
   the page gathers the waiting ones into a message to paste to a
   tandem partner, a teacher or r/turkishlearning, and the learner marks
   each one right or types the correction. Only checked sentences go
   into the drill. The learner can mark a sentence right themselves; the
   page says who should.

   Sentences are keyed by a counter, never by position or text, so a
   correction keeps the sentence's place and "i:<id>" in S.prod is as
   stable as the sentence. A corrected sentence is a new thing to learn,
   so a correction clears its schedule. */
const ADA_DAY=5, ADA_MAX=400;
let ADAF=null;        /* the open form: {isl,q} to write, {edit:id} or {fix:id} */
let ADAMSG="";        /* a message that has to survive the redraw after a save */

function adaStore(){if(!S.ada||!S.ada.s)S.ada={n:0,s:[]};return S.ada;}
function adaIsl(id){return ADA.find(function(x){return x.id===id;});}
function adaQ(isl,qid){const i=adaIsl(isl);return i?i.q.find(function(q){return q.id===qid;}):null;}
function adaQOpen(q){return metGram(q.u);}
/* An island opens with its first question; a closed one is not listed. */
function adaOpen(){return ADA.filter(function(i){return i.q.some(adaQOpen);});}
function adaOf(isl,qid){return adaStore().s.filter(function(x){return x.isl===isl&&(qid===undefined||x.q===qid);});}
function adaById(id){return adaStore().s.find(function(x){return x.id===id;});}
function adaWaiting(){return adaStore().s.filter(function(x){return !x.chk;});}
function adaToday(){const n=dayNum();return adaStore().s.filter(function(x){return x.day===n;}).length;}
/* Pasted text can carry soft hyphens and zero-width spaces that look
   right and break every match; the same cleaning Kendi kelimelerim does,
   with room for a sentence. */
function adaClean(s){
  return String(s==null?"":s)
    .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g,"")
    .replace(/[\u0000-\u001F\u007F]/g," ")
    .replace(/\s+/g," ").trim().slice(0,240);
}

/* --- the drill bank ---------------------------------------------------- */
/* Checked sentences only, oldest first, riding Üretim's runner: the
   English (the learner's own) is the prompt, the Turkish the model. */
function adaBank(){
  return adaStore().s.filter(function(x){return x.chk;}).map(function(x){
    const i=adaIsl(x.isl);
    return {k:"i:"+x.id,tr:x.tr,en:x.en,lv:"Adacık",from:i?i.tr:""};
  });
}

/* --- writing ------------------------------------------------------------ */
function adaWrite(isl,qid){ADAF={isl:isl,q:qid};ADAMSG="";render();focusSoon("adatr");}
function adaEdit(id){ADAF={edit:id};ADAMSG="";render();focusSoon("adatr");}
function adaFix(id){ADAF={fix:id};ADAMSG="";render();focusSoon("adatr");}
function adaCancel(){ADAF=null;ADAMSG="";render();}
function focusSoon(id){const el=document.getElementById(id);if(el&&el.focus)el.focus();}
/* A refusal must not redraw: the boxes hold what was typed. */
function adaSay(msg){const el=document.getElementById("adamsg");if(el)el.textContent=msg;}
function adaSave(){
  if(!ADAF)return;
  const tbox=document.getElementById("adatr"), ebox=document.getElementById("adaen");
  const tr=adaClean(tbox&&tbox.value), en=adaClean(ebox&&ebox.value);
  if(!tr){adaSay(txt("Write the Turkish first.","Önce Türkçesini yaz."));return;}
  if(!en){adaSay(txt("Add what it means in English: it is the prompt when you drill it.","İngilizcesini de yaz: çalışırken soru o olacak."));return;}
  const st=adaStore();
  if(ADAF.edit||ADAF.fix){
    const x=adaById(ADAF.edit||ADAF.fix); if(!x){ADAF=null;render();return;}
    const changed=x.tr!==tr;
    if(ADAF.fix){
      if(changed&&!x.was)x.was=x.tr;
      x.chk=1;
      ADAMSG=changed?txt("Corrected. The corrected sentence is what you will drill.","Düzeltildi. Çalışacağın cümle düzeltilmiş hâli."):txt("Marked as checked.","Kontrol edildi olarak işaretlendi.");
    }else if(changed&&x.chk){
      /* Nobody checked the new wording. */
      x.chk=0;
      ADAMSG=txt("Changed, so it waits to be checked again.","Değişti; yeniden kontrol edilmeyi bekliyor.");
    }else ADAMSG=txt("Saved.","Kaydedildi.");
    /* A different sentence is a new one to learn. */
    if(changed&&S.prod&&S.prod["i:"+x.id]){delete S.prod["i:"+x.id];}
    x.tr=tr; x.en=en;
  }else{
    if(st.s.length>=ADA_MAX){adaSay(txt("The island is full: delete a sentence first.","Adacık dolu: önce bir cümle sil."));return;}
    st.n++;
    st.s.push({id:String(st.n),isl:ADAF.isl,q:ADAF.q,tr:tr,en:en,day:dayNum(),chk:0,was:""});
    ADAMSG=txt("Saved. It waits to be checked before it is drilled.","Kaydedildi. Çalışılmadan önce kontrol edilmeyi bekliyor.");
  }
  ADAF=null; save(); render();
}
function adaOk(id){const x=adaById(id); if(!x)return; x.chk=1; ADAMSG=""; save(); render();}
function adaDel(id){
  if(typeof confirm==="function"&&!confirm(txt("Delete this sentence?","Bu cümle silinsin mi?")))return;
  const st=adaStore();
  st.s=st.s.filter(function(x){return x.id!==id;});
  if(S.prod)delete S.prod["i:"+id];
  if(S.err)delete S.err["i:"+id];
  ADAF=null; ADAMSG=""; save(); render();
}
function adaHear(id){const x=adaById(id); if(x)say(x.tr);}
function adaHearQ(isl,qid){const q=adaQ(isl,qid); if(q)say(q.tr);}

/* --- getting it checked -------------------------------------------------- */
/* The message to paste, Turkish first so a Turkish speaker reads it as
   addressed to them, with the question each sentence answers, because
   "Yedide." is only checkable against "Kaçta kalkıyorsun?". */
function adaExport(){
  const w=adaWaiting();
  if(!w.length)return "";
  let t="Merhaba! Türkçe öğreniyorum. Aşağıdaki cümleleri düzeltebilir misiniz? Teşekkürler.\n"+
        "Hi! I am learning Turkish. Could you correct the sentences below? Thank you.\n";
  w.forEach(function(x,i){
    const q=adaQ(x.isl,x.q);
    t+="\n"+(i+1)+". "+x.tr+"\n   ("+x.en+(q?" · soru: "+q.tr:"")+")";
  });
  return t;
}
function adaCopy(){
  const box=document.getElementById("adaexp"); if(!box)return;
  const done=function(){const b=document.getElementById("adacopied");if(b)b.textContent=txt("Copied.","Kopyalandı.");};
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(box.value).then(done,function(){box.select();});return;}
  }catch(e){}
  try{box.select();document.execCommand("copy");done();}catch(e){}
}

/* --- screens -------------------------------------------------------------- */
/* Shown once, on the redraw after the save that set it. */
function adaNote(){
  const m=ADAMSG; ADAMSG="";
  return m?'<p class="tiny adamsg" role="status">'+esc(m)+'</p>':'';
}
function adaGo(v,id){ADAF=null;ADAMSG="";go(v,id);}
function adaRow(x){
  let h='<div class="adas'+(x.chk?' ok':'')+'">'+
    '<p class="adatr">'+esc(x.tr)+'</p>'+
    '<p class="tiny" style="margin:.1rem 0 .3rem">'+esc(x.en)+'</p>';
  if(x.was)h+='<p class="tiny adawas">'+tx('before: ','önce: ')+'<s>'+esc(x.was)+'</s></p>';
  h+='<div class="row" style="gap:.35rem;flex-wrap:wrap">'+
    '<span class="pill'+(x.chk?' turk':' gold')+'">'+(x.chk?'kontrol edildi':'kontrol bekliyor')+'</span>'+
    '<span class="grow"></span>'+
    '<button class="sbtn" onclick="adaHear(\''+x.id+'\')">'+IC.spk+'</button>'+
    '<button class="sbtn" onclick="adaEdit(\''+x.id+'\')">değiştir</button>'+
    '<button class="sbtn" onclick="adaDel(\''+x.id+'\')">sil ×</button></div></div>';
  return h;
}
function adaForm(x,q){
  const tr=x?x.tr:"", en=x?x.en:"";
  let h='<div class="card adaform">';
  if(ADAF.fix)h+='<p class="tiny">'+tx('Type the corrected sentence, or leave it as it is if it was right.','Düzeltilmiş cümleyi yaz; doğruysa olduğu gibi bırak.')+'</p>';
  else if(q)h+='<p class="tiny">'+tx('Answer about yourself, in a whole sentence.','Kendin hakkında, tam bir cümleyle cevap ver.')+'</p>';
  h+='<textarea class="inp" id="adatr" rows="2" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Türkçe…">'+esc(tr)+'</textarea>'+
   '<input class="inp" id="adaen" autocomplete="off" placeholder="English meaning…" value="'+esc(en)+'">'+
   '<p class="tiny" id="adamsg" role="status"></p>'+
   '<div class="btn-row"><button class="btn ghost" onclick="adaCancel()">Vazgeç</button>'+
   '<button class="btn" onclick="adaSave()">'+(ADAF.fix?'Kontrol edildi':'Kaydet')+'</button></div></div>';
  return h;
}
function renderAda(){
  const open=adaOpen(), st=adaStore(), wait=adaWaiting().length, chk=st.s.length-wait;
  const due=adaBank().length?prodDue(adaBank()).length:0;
  let h=bar("Adacıklar","your own Turkish, about your life",true,"kendi hayatın, kendi Türkçen")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('The first things anyone asks you in Turkish are about you: where you are from, what you do, what you did at the weekend. Answer them here, a few sentences a day, in the grammar you have met. Get them checked by someone who speaks Turkish, then drill them until they come out whole. Those prepared patches are your islands, and a conversation is stepping from one to the next.',
    'Türkçe konuşan birinin sana ilk sorduğu şeyler seninle ilgilidir: nerelisin, ne iş yapıyorsun, hafta sonu ne yaptın. Onları burada, günde birkaç cümleyle, öğrendiğin dilbilgisiyle cevapla. Türkçe bilen birine kontrol ettir, sonra bütün olarak çıkana kadar çalış. Hazırladığın bu parçalar senin adacıkların; konuşmak, birinden ötekine geçmektir.')+'</p>';
  h+=adaNote();
  if(!open.length){
    h+='<div class="card"><p class="lead">Şimdilik boş<span class="gl">empty for now</span></p><p class="sub">'+
     tx('It opens with the grammar of A1 unit 1, which is enough to say your name and where you are from. More questions open as you read each unit’s grammar.',
        'A1’in 1. ünitesinin dilbilgisiyle açılır; adını ve nereli olduğunu söylemeye yeter. Her ünitenin dilbilgisini okudukça yeni sorular açılır.')+'</p></div></div>';
    paint(h);return;
  }
  h+='<div class="stat"><div><b>'+adaToday()+'/'+ADA_DAY+'</b><span>'+tx('today','bugün')+'</span></div>'+
     '<div><b>'+wait+'</b><span>'+tx('to check','kontrol bekliyor')+'</span></div>'+
     '<div><b>'+chk+'</b><span>'+tx('checked','kontrol edildi')+'</span></div></div>';
  if(due)h+='<button class="btn" onclick="startProd(\'i\')">Söyle · say your islands</button>';
  else if(chk)h+='<p class="tiny" style="text-align:center">'+tx('Nothing to drill today: your checked sentences come back as their boxes come round.','Bugün çalışılacak bir şey yok: kontrol edilen cümlelerin sırası gelince geri gelir.')+'</p>';
  if(wait)h+='<button class="btn'+(due?' ghost':'')+'" onclick="adaGo(\'adakontrol\')">Kontrol ettir · get them checked</button>';
  h+='<h2 class="sec">Adacıklar</h2>';
  open.forEach(function(i){
    const n=adaOf(i.id).length, qo=i.q.filter(adaQOpen).length;
    h+='<button class="card nav row" onclick="adaGo(\'adaisl\',\''+i.id+'\')"><div class="grow"><p class="lead nav-t">'+esc(i.tr)+'</p>'+
      '<p class="sub">'+esc(i.en)+' · '+tx(qo+' of '+i.q.length+' questions open',i.q.length+' sorudan '+qo+' açık')+'</p></div>'+
      (n?'<span class="pill">'+n+'</span>':'')+'<span class="chev">'+IC.chev+'</span></button>';
  });
  const closed=ADA.length-open.length;
  if(closed)h+='<p class="tiny" style="margin:.4rem .2rem">'+tx(closed+' more open as you read further units’ grammar.',closed+' adacık daha, ilerideki ünitelerin dilbilgisini okudukça açılır.')+'</p>';
  h+='<p class="foot">'+tx('Only sentences someone has checked are drilled: rehearsing a mistake is the one way a drill makes you worse.',
    'Yalnızca kontrol edilmiş cümleler çalışılır: bir yanlışı ezberlemek, alıştırmanın seni kötüleştirdiği tek yoldur.')+'</p></div>';
  paint(h);
}
function renderAdaIsl(){
  const i=adaIsl(V.u);
  if(!i||!i.q.some(adaQOpen)){go("ada");return;}
  let h=bar(i.tr,i.en,true)+'<div class="wrap">';
  h+=adaNote();
  i.q.forEach(function(q){
    if(!adaQOpen(q)){
      const u=unit(q.u);
      h+='<div class="card adaq off"><p class="lead">'+esc(q.tr)+'</p><p class="tiny">'+
        tx('Opens with the grammar of '+esc(u.lv+' · '+u.tr)+'.',esc(u.lv+' · '+u.tr)+' ünitesinin dilbilgisiyle açılır.')+'</p></div>';
      return;
    }
    const mine=adaOf(i.id,q.id);
    h+='<div class="card adaq"><div class="row" style="gap:.4rem"><p class="lead grow" style="margin:0">'+esc(q.tr)+'</p>'+
      '<button class="sbtn" onclick="adaHearQ(\''+i.id+'\',\''+q.id+'\')">'+IC.spk+'</button></div>'+
      '<p class="ven">'+esc(q.en)+'</p>'+
      '<p class="tiny adaeg">'+tx('For example','Örneğin')+': <span class="adaegt">'+esc(q.eg[0])+'</span> · '+esc(q.eg[1])+'</p>';
    mine.forEach(function(x){
      h+=(ADAF&&(ADAF.edit===x.id||ADAF.fix===x.id))?adaForm(x,q):adaRow(x);
    });
    if(ADAF&&ADAF.isl===i.id&&ADAF.q===q.id)h+=adaForm(null,q);
    else h+='<button class="btn ghost" onclick="adaWrite(\''+i.id+'\',\''+q.id+'\')">Yaz · write</button>';
    h+='</div>';
  });
  h+='</div>';
  paint(h);
}
function renderAdaKontrol(){
  const w=adaWaiting();
  let h=bar("Kontrol ettir","get them checked",true,"kontrol ettir")+'<div class="wrap">';
  h+=adaNote();
  if(!w.length){
    h+='<div class="card"><p class="lead">'+tx('Everything is checked.','Hepsi kontrol edildi.')+'</p>'+
      '<button class="btn" onclick="adaGo(\'ada\')">Adacıklar</button></div></div>';
    paint(h);return;
  }
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('Copy this and send it to someone who speaks Turkish: a tandem partner, a teacher, a friend, or a post on r/turkishlearning. Then mark each sentence below as right, or type in the correction you were given.',
    'Bunu kopyala ve Türkçe bilen birine gönder: bir tandem arkadaşına, bir öğretmene, bir arkadaşına ya da r/turkishlearning’de bir gönderi olarak. Sonra aşağıdaki her cümleyi doğru diye işaretle ya da sana verilen düzeltmeyi yaz.')+'</p>';
  h+='<div class="card"><textarea class="inp adaexp" id="adaexp" rows="8" readonly>'+esc(adaExport())+'</textarea>'+
    '<button class="btn" onclick="adaCopy()">Kopyala · copy</button><p class="tiny" id="adacopied" role="status"></p></div>';
  h+='<h2 class="sec">Cevap gelince</h2>';
  w.forEach(function(x){
    const q=adaQ(x.isl,x.q);
    if(ADAF&&ADAF.fix===x.id){h+=adaForm(x,q);return;}
    h+='<div class="card adas"><p class="tiny">'+esc(q?q.tr:"")+'</p><p class="adatr">'+esc(x.tr)+'</p>'+
      '<p class="tiny" style="margin:.1rem 0 .4rem">'+esc(x.en)+'</p>'+
      '<div class="btn-row"><button class="btn ghost" onclick="adaFix(\''+x.id+'\')">Düzelt · correct it</button>'+
      '<button class="btn" onclick="adaOk(\''+x.id+'\')">Doğru · it was right</button></div></div>';
  });
  h+='<p class="foot">'+tx('If there is no one to ask yet, you can mark a sentence right yourself. Only do it when you are sure: what is checked is what gets drilled.',
    'Henüz soracak kimse yoksa bir cümleyi kendin doğru diye işaretleyebilirsin. Yalnızca eminsen yap: kontrol edilen, çalışılan olur.')+'</p></div>';
  paint(h);
}
