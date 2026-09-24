/* Dinleme: listening without the text. Dictation, which is the only
   exercise in the app that can tell the learner they were wrong, and
   audio-first comprehension, which takes the reading crutch away. */

/* ===================== dinleme · listening ===================== */
/* Reading and shadowing both leave the text on screen, so they train
   decoding with a safety net. These two remove it:

   1. Dikte — hear a line, type what you heard. The app scores it word by
      word, so a word that never arrived is named rather than guessed at.
      This is the one place the app has real error detection; everything
      else in Üretim is self-graded and cannot see what the learner cannot
      hear.
   2. Ses önce — hear a line at speed with nothing on screen, decide
      whether it landed, then reveal. Self-graded, because comprehension
      has no typed evidence, but the decision comes before the reveal.

   Both keep their own schedule in S.dinle. A sentence can be easy to
   recognise and hard to produce, so sharing Üretim's boxes would blur two
   different skills. Keys are permanent, like unit ids:
   "d:<unitId>#<line>" for dictation, "a:<unitId>#<line>" for audio-first.

   The rate lives in S.drate and starts at 1x, not at the 0.85 the reading
   screen uses: a study pace is not a listening target. DK holds a run and,
   like VOICE, PR and Q, has to survive a re-render. */
const DRATES=[0.85,1,1.15,1.3,1.5];
const DREPLAYS=[1,2,3,0];            /* 0 means as many as you like */
const DSESSION=8;                    /* shorter than Üretim: typing is slow */
let DK=null;

function drate(){return S.drate||1;}
function setDrate(r){S.drate=r;save();render();}
function dreplay(){return S.dreplay===0?0:(S.dreplay||2);}
function setDreplay(n){S.dreplay=n;save();render();}
function replayLeft(){return dreplay()===0?99:dreplay()-(DK?DK.plays:0);}

/* The same passage lines Üretim draws on, re-keyed for this mode and
   filtered by the same Kaynak setting, so the two modes walk the same
   material rather than disagreeing about what is in range. */
function listenBank(pfx){
  return sentenceBank().map(function(it){
    return {k:pfx+it.k.slice(2),tr:it.tr,en:it.en,lv:it.lv,from:it.from};
  });
}
function dinleDue(pfx){
  return dueItems(S.dinle,listenBank(pfx),NEW_DAY.dinle,pfx).length;
}
function dinleGrade(k,good){
  if(!S.dinle)S.dinle={};
  bump(S.dinle,k,function(b){return good?b+1:0;});
  save();
}

/* --- the run --------------------------------------------------------- */
function dinleStop(){if(DK&&DK.tid){clearTimeout(DK.tid);DK.tid=null;}}
function startDinle(mode){
  stopPlay();
  if(!ttsOK()){V={view:"dinle"};render();return;}
  const q=dueQueue(S.dinle,listenBank(mode+":"),DSESSION,NEW_DAY.dinle,mode+":");
  if(!q.length){V={view:"dinle"};render();return;}
  DK={mode:mode,q:q,i:0,phase:"play",typed:"",plays:0,res:null,right:0,tid:null};
  V={view:"dinlerun"};window.scrollTo(0,0);
  touchDay();dinleStep();
}
function dinleStep(){
  if(!DK)return;
  const it=DK.q[DK.i];
  if(!it){DK.phase="end";render();return;}
  DK.phase="play";DK.typed="";DK.plays=0;DK.res=null;
  render();dinlePlay();
}
/* Replaying must not redraw: the input box holds what has been typed so
   far, and a re-render would throw it away. The counter is poked directly
   for the same reason. */
function dinlePlay(){
  if(!DK)return;
  const it=DK.q[DK.i]; if(!it)return;
  keepTyped();                 /* before the guard: a refused replay must
                                  not be able to lose what has been typed */
  if(replayLeft()<=0)return;
  DK.plays++;
  const el=document.getElementById("dplays");
  if(el)el.textContent=dplaysText();
  const b=document.getElementById("dagain");
  if(b&&replayLeft()<=0)b.setAttribute("disabled","");
  say(it.tr,drate());
}
function dplaysText(){
  return dreplay()===0?(DK.plays+" kez"):(DK.plays+" / "+dreplay());
}
function keepTyped(){
  const box=document.getElementById("dbox");
  if(box&&DK)DK.typed=box.value;
}
function dikteCheck(){
  if(!DK)return;
  const it=DK.q[DK.i]; if(!it)return;
  keepTyped();
  DK.res=dictScore(it.tr,DK.typed);
  const good=dictPass(DK.res);
  dinleGrade(it.k,good);
  if(good)DK.right++;
  else errNote(it.k,{m:"d",q:it.en,c:it.tr,a:DK.typed,to:errUnitOf(it.k)});
  DK.phase="check";window.scrollTo(0,0);render();
}
function hearReveal(){
  if(!DK)return;
  DK.phase="reveal";render();
  const it=DK.q[DK.i]; if(it)say(it.tr,drate());
}
function hearMark(good){
  if(!DK)return;
  const it=DK.q[DK.i]; if(!it)return;
  dinleGrade(it.k,good);
  if(good)DK.right++;
  else errNote(it.k,{m:"a",q:it.en,c:it.tr,to:errUnitOf(it.k)});
  dinleNext();
}
function dinleSay(){
  const it=DK&&DK.q[DK.i];
  if(it)say(it.tr,drate());
}
function dinleNext(){
  dinleStop();
  if(!DK)return;
  DK.i++;window.scrollTo(0,0);
  if(DK.i>=DK.q.length){DK.phase="end";render();return;}
  dinleStep();
}

/* --- screens ---------------------------------------------------------- */
function renderDinle(){
  const dd=dinleDue("d:"), ad=dinleDue("a:"), bank=sentenceBank().length;
  let h=bar("Dinleme","listening · no text",true,"metinsiz dinleme")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('Reading and shadowing keep the text in front of you. These two take it away: one asks you to <b>write</b> what you heard, the other only to understand it. The speed goes past normal on purpose.',
    'Okuma ve gölge çalışmasında metin önündedir. Bu ikisi metni kaldırır: biri duyduğunu <b>yazmanı</b>, öteki yalnızca anlamanı ister. Hızın normali geçmesi bilerek yapıldı.')+'</p>';

  if(!ttsOK()){
    h+='<div class="card"><p class="lead">Ses yok</p><p class="sub">'+tx('This browser has no speech synthesis, so there is nothing to listen to. On a phone the app’s other modes still work.',
      'Bu tarayıcıda konuşma sentezi yok, yani dinlenecek bir şey yok. Telefonda uygulamanın öteki bölümleri yine çalışır.')+'</p></div></div>';
    paint(h);return;
  }
  h+=voiceNote();

  h+='<div class="stat"><div><b>'+dd+'</b><span>dikte</span></div>'+
     '<div><b>'+ad+'</b><span>ses önce</span></div>'+
     '<div><b>'+drate()+'×</b><span>hız</span></div></div>';

  h+='<h2 class="sec">Çalış</h2>';
  h+='<div class="card"><p class="lead">Dikte · write what you hear</p>'+
   '<p class="sub">'+tx('A line plays with nothing on screen. Type it, and the app marks it word by word — diacritics are ignored, missing words are not. '+
   bank+' line'+(bank===1?"":"s")+' in range · '+dd+' due today. Up to '+DSESSION+' in a sitting.',
   'Ekranda hiçbir şey yokken bir satır çalar. Onu yaz; uygulama kelime kelime değerlendirir. Şapkalı ve noktalı harfler önemsenmez, eksik kelimeler önemsenir. '+
   'Kapsamda '+bank+' satır · bugün '+dd+' tane. Bir oturumda en fazla '+DSESSION+'.')+'</p>'+
   '<button class="btn" onclick="startDinle(\'d\')">Başla</button></div>';
  h+='<div class="card"><p class="lead">Ses önce · audio first</p>'+
   '<p class="sub">'+tx('The same lines, but nothing is typed: listen, decide whether you got it, and only then see the Turkish and the English. '+ad+' due today.',
     'Aynı satırlar, ama yazı yok: dinle, anlayıp anlamadığına karar ver, Türkçesini ve İngilizcesini ancak ondan sonra gör. Bugün '+ad+' tane.')+'</p>'+
   '<button class="btn" onclick="startDinle(\'a\')">Başla</button></div>';

  h+='<h2 class="sec">Ayarlar</h2><div class="card">';
  h+='<p class="lead" style="font-size:.95rem">Hız · listening speed</p>'+
   '<p class="sub">'+tx('1× is where the voice sits naturally. Above it is the training — a conversation will not slow down for you.',
     'Sesin doğal hızı 1×. Üstü alıştırma içindir; bir konuşma senin için yavaşlamaz.')+'</p><div class="segs">';
  DRATES.forEach(function(r){
    h+='<button class="'+(Math.abs(r-drate())<0.01?"on":"")+'" onclick="setDrate('+r+')">'+r+'×'+
      (r>1?'<i>hızlı</i>':r===1?'<i>normal</i>':'<i>yavaş</i>')+'</button>';
  });
  h+='</div>';
  h+='<p class="lead" style="font-size:.95rem">Tekrar · replays allowed</p>'+
   '<p class="sub">'+tx('Fewer replays is harder and closer to the real thing, where a sentence is said once.',
     'Daha az tekrar daha zordur ve gerçeğe daha yakındır; gerçekte bir cümle bir kez söylenir.')+'</p><div class="segs">';
  DREPLAYS.forEach(function(n){
    h+='<button class="'+(n===dreplay()?"on":"")+'" onclick="setDreplay('+n+')">'+(n===0?"∞":n)+'<i>'+(n===0?"serbest":"kez")+'</i></button>';
  });
  h+='</div>';
  h+='<p class="tiny">'+tx('Sentences come from the same <b>Kaynak</b> range as Üretim — change it there.','Cümleler Üretim’deki <b>Kaynak</b> ayarından gelir; oradan değiştir.')+'</p></div>';

  h+='<p class="foot">'+tx('This is the device’s own Turkish voice, not a recording of a person.<br>'+
   'It has no reduction, no accent and no overlapping turns, so treat a clean 1.5× here as a floor rather than a finish.',
   'Bu, cihazın kendi Türkçe sesi; bir insan kaydı değil.<br>Kısaltma, şive ya da üst üste konuşma yok; burada temiz bir 1.5× bir başlangıçtır, varış değil.')+'</p></div>';
  paint(h);
}

function renderDinleRun(){
  if(!DK){renderDinle();return;}
  const dikte=DK.mode==="d";
  if(DK.phase==="end"){
    /* Dikte is a Bugün step; Ses önce is reached from Araçlar. */
    endScreen({title:"Dinleme",n:DK.right,of:DK.q.length,
               label:dikte?"kelimesi kelimesine · marked by the app":"kendi değerlendirmen · your own marking",
               plan:dikte,again:dinleDue(DK.mode+":")?"startDinle('"+DK.mode+"')":"",
               hub:"go('dinle')",hubName:"Dinleme"});
    return;
  }
  const it=DK.q[DK.i];
  let h=bar("Dinleme",(DK.i+1)+" / "+DK.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+DK.q.map(function(_,i){return '<i class="'+(i<DK.i?"ok":"")+'"></i>';}).join('')+'</div>';
  h+='<p class="qn">'+(dikte?"Yaz · write what you hear":"Dinle · then say whether it landed")+'</p>';

  if(DK.phase==="play"){
    h+='<div class="card" style="text-align:center;padding:1.6rem 1rem">'+
     '<button class="sbtn" style="font-size:1rem" id="dagain" onclick="dinlePlay()"'+
     (replayLeft()<=0?' disabled':'')+'>'+IC.spk+' tekrar dinle</button>'+
     '<p class="tiny" id="dplays" style="margin:.5rem 0 0">'+dplaysText()+'</p>'+
     '<p class="tiny" style="margin:.2rem 0 0">'+drate()+'× · '+tx('nothing is shown until you commit','karar verene kadar hiçbir şey gösterilmez')+'</p></div>';
    if(dikte){
      h+='<input class="inp" id="dbox" autocapitalize="off" autocomplete="off" autocorrect="off" '+
       'spellcheck="false" placeholder="duyduğunu yaz…" value="'+esc(DK.typed||"")+'">'+
       '<button class="btn" onclick="dikteCheck()">Kontrol et</button>';
    }else{
      h+='<button class="btn" onclick="hearReveal()">Göster</button>';
    }
  }else if(DK.phase==="check"){
    const r=DK.res, pass=dictPass(r);
    h+='<div class="card"><p class="dline">'+r.ops.map(function(o){
      return '<span class="dw '+(o.t==="ok"?"":o.t)+'">'+esc(o.w)+'</span>';
    }).join(" ")+'</p>'+
     '<p class="sub" style="margin-top:.6rem">'+esc(it.en)+'</p>'+
     spkBtn(it.tr,{text:" tekrar",style:"margin-top:.4rem"})+'</div>';
    h+='<div class="fb '+(pass?"ok":"no")+'"><b>'+r.hit+' / '+r.of+' kelime'+(pass?" · Doğru":"")+'</b>'+
     tx((r.extra?"Struck-through words were not said. ":"")+
        (pass?"Anything in red was missed — read it once more before moving on."
             :"Red words never reached you. Replay it, then take the next one."),
        (r.extra?"Üstü çizili kelimeler söylenmedi. ":"")+
        (pass?"Kırmızılar kaçırıldı; geçmeden önce bir kez daha oku."
             :"Kırmızı kelimeler sana ulaşmadı. Yeniden dinle, sonra sıradakine geç."))+'</div>';
    h+='<button class="btn" onclick="dinleNext()">'+(DK.i+1>=DK.q.length?"Sonuç":"Devam")+'</button>';
  }else{
    h+='<div class="card" style="text-align:center;padding:1.6rem 1rem">'+
     '<p style="font-family:\'Crimson Pro\',serif;font-size:1.5rem;line-height:1.35;margin:0">'+esc(it.tr)+'</p>'+
     '<p class="sub" style="margin-top:.6rem">'+esc(it.en)+'</p>'+
     '<button class="sbtn" style="margin-top:.5rem" onclick="dinleSay()">'+IC.spk+' tekrar</button></div>';
    h+='<div class="btn-row"><button class="btn ghost" onclick="hearMark(false)">Anlamadım</button>'+
     '<button class="btn" onclick="hearMark(true)">Anladım</button></div>';
  }
  h+='<p class="tiny" style="text-align:center;margin-top:.7rem">'+esc(it.lv+" · "+it.from)+'</p>';
  h+='</div>';
  paint(h);
  const box=document.getElementById("dbox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")dikteCheck();});
  }
}
