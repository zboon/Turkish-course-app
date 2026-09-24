/* Dinleme günlüğü: the Turkish met outside the app, logged in minutes. */

/* ===================== günlük · the input log ===================== */
/* Everything in this app is a few thousand sentences, in one synthetic
   voice. What turns a course into a language is hours of real Turkish
   heard at a level just above the learner's own: podcasts, videos,
   television, reading, talking to people. People who learn languages
   well count those hours, because the count is what keeps them coming
   back to it, and because it is honest in a way a feeling of progress
   is not.

   The app cannot supply that input and does not pretend to. It keeps
   the count: minutes, where they came from, what kind, and how much was
   understood. "Most" is the band worth aiming at, which the page says;
   "a little" for long is noise and "all" is review.

   No sources are built in. Names of channels and podcasts go stale, and
   none could be checked from here, so the learner adds their own, with
   a link if they like. Nothing here schedules or grades anything; it is
   a record, like the mistake book, and it is progress: wipe() clears
   it and a backup carries it. Entries and sources are keyed by a
   counter, and an entry keeps its source's name, so deleting a source
   does not orphan an hour already spent. */
const LOG_KINDS=[["d","Dinleme","listening"],["i","İzleme","watching"],["o","Okuma","reading"],["k","Konuşma","talking"]];
const LOG_UND=[["az","a little"],["yarısı","about half"],["çoğu","most"],["hepsi","nearly all"]];
const LOG_QUICK=[10,15,20,30,45,60];
const LOG_MARKS=[10,25,50,100,150,250,500,750,1000,1500,2000];
const LOG_MAX=5000;
let LOGF=null, LOGMSG="";

function logStore(){if(!S.log||!S.log.e)S.log={n:0,e:[],src:[]};if(!S.log.src)S.log.src=[];return S.log;}
function logTotal(){return logStore().e.reduce(function(n,x){return n+x.min;},0);}
function logSince(days){const from=dayNum()-days+1;return logStore().e.reduce(function(n,x){return n+(x.day>=from?x.min:0);},0);}
function logDay(d){return logStore().e.reduce(function(n,x){return n+(x.day===d?x.min:0);},0);}
/* Days in a row with something logged, counting back from today, or
   from yesterday when today is still empty: an evening's listening not
   yet logged should not read as a broken run at breakfast. */
function logStreak(){
  const has={}; logStore().e.forEach(function(x){has[x.day]=1;});
  let d=dayNum(); if(!has[d])d--;
  let n=0; while(has[d]){n++;d--;}
  return n;
}
function logHM(min){
  const h=Math.floor(min/60), m=min%60;
  return h?(h+" sa"+(m?" "+m+" dk":"")):m+" dk";
}
/* The short form for a stat box: 4,5 sa rather than 4 sa 30 dk. */
function logH(min){return min<60?min+" dk":String(Math.round(min/6)/10).replace(".",",")+" sa";}
function logNextMark(){const h=logTotal()/60;return LOG_MARKS.find(function(m){return m>h;})||null;}
function logSrc(id){return logStore().src.find(function(s){return s.id===id;});}
function logSrcMin(id){return logStore().e.reduce(function(n,x){return n+(x.src===id?x.min:0);},0);}
/* A link is kept only if it is a web address, so nothing else can end
   up behind an href. */
function logUrl(u){u=String(u||"").trim();return /^https?:\/\/[^\s"'<>]+$/i.test(u)&&u.length<=300?u:"";}
function logClean(s,max){return String(s==null?"":s).replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g,"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,max);}

/* --- the form ------------------------------------------------------------ */
function logOpen(){LOGF=null;LOGMSG="";go("gunluk");}
function logNew(){
  const last=logStore().e[logStore().e.length-1];
  LOGF={min:20,src:last&&logSrc(last.src)?last.src:(logStore().src.length?logStore().src[0].id:"new"),
        name:"",url:"",kind:last?last.kind:"d",und:2,ago:0};
  LOGMSG=""; render();
}
/* The segmented choices redraw the form, so what has been typed is
   read into LOGF first or the redraw would empty it. */
function logKeep(){
  if(!LOGF)return;
  const g=function(id){const el=document.getElementById(id);return el?el.value:null;};
  const m=g("logmin"), s=g("logsrc"), n=g("logname"), u=g("logurl");
  if(m!==null)LOGF.min=m; if(s!==null)LOGF.src=s; if(n!==null)LOGF.name=n; if(u!==null)LOGF.url=u;
}
function logSet(k,v){if(!LOGF)return;logKeep();LOGF[k]=v;render();}
function logCancel(){LOGF=null;render();}
function logSay(msg){const el=document.getElementById("logmsg");if(el)el.textContent=msg;}
function logSave(){
  if(!LOGF)return;
  logKeep();
  const min=Math.round(Number(String(LOGF.min).replace(",",".")));
  if(!(min>=1&&min<=600)){logSay(txt("Minutes: a number from 1 to 600.","Dakika: 1 ile 600 arasında bir sayı."));return;}
  const st=logStore();
  if(st.e.length>=LOG_MAX){logSay(txt("The log is full: delete old entries first.","Günlük dolu: önce eski kayıtları sil."));return;}
  let src=LOGF.src;
  if(src==="new"||!logSrc(src)){
    const name=logClean(LOGF.name,60);
    if(!name){logSay(txt("Name the source: a podcast, a channel, a book, a person.","Kaynağa bir ad ver: bir podcast, bir kanal, bir kitap, bir kişi."));return;}
    const had=st.src.find(function(s){return fold(s.name)===fold(name);});
    if(had)src=had.id;
    else{st.n++;src="s"+st.n;st.src.push({id:src,name:name,kind:LOGF.kind,url:logUrl(LOGF.url)});}
  }
  st.n++;
  st.e.push({id:"e"+st.n,day:dayNum()-(Number(LOGF.ago)||0),min:min,src:src,nm:logSrc(src).name,kind:LOGF.kind,und:Number(LOGF.und)});
  LOGF=null;
  LOGMSG=txt(logHM(min)+" logged.",logHM(min)+" kaydedildi.");
  touchDay(); save(); render();
}
function logDel(id){
  if(typeof confirm==="function"&&!confirm(txt("Delete this entry?","Bu kayıt silinsin mi?")))return;
  const st=logStore(); st.e=st.e.filter(function(x){return x.id!==id;}); save(); render();
}
function logSrcDel(id){
  if(typeof confirm==="function"&&!confirm(txt("Remove this source? Time already logged from it stays.","Bu kaynak kaldırılsın mı? Ondan kaydedilen süre kalır.")))return;
  const st=logStore(); st.src=st.src.filter(function(s){return s.id!==id;}); save(); render();
}

/* --- screens --------------------------------------------------------------- */
function logNote(){const m=LOGMSG;LOGMSG="";return m?'<p class="tiny adamsg" role="status">'+esc(m)+'</p>':'';}
function logSeg(k,v,lab,en){
  return '<button class="'+(String(LOGF[k])===String(v)?'on':'')+'" onclick="logSet(\''+k+'\',\''+v+'\')">'+esc(lab)+(en?'<i><span class="gl">'+esc(en)+'</span></i>':'')+'</button>';
}
function logForm(){
  const st=logStore();
  let h='<div class="card adaform">';
  h+='<p class="tiny">'+tx('How long?','Ne kadar?')+'</p><div class="segs">'+
    LOG_QUICK.map(function(m){return logSeg("min",m,String(m));}).join('')+'</div>'+
    '<input class="inp" id="logmin" inputmode="numeric" autocomplete="off" value="'+esc(String(LOGF.min))+'" aria-label="dakika">';
  h+='<p class="tiny">'+tx('What?','Ne?')+'</p><div class="segs">'+LOG_KINDS.map(function(k){return logSeg("kind",k[0],k[1],k[2]);}).join('')+'</div>';
  h+='<p class="tiny">'+tx('From where?','Nereden?')+'</p><select class="inp" id="logsrc" onchange="logSet(\'src\',this.value)">'+
    st.src.map(function(s){return '<option value="'+esc(s.id)+'"'+(LOGF.src===s.id?' selected':'')+'>'+esc(s.name)+'</option>';}).join('')+
    '<option value="new"'+(LOGF.src==="new"||!logSrc(LOGF.src)?' selected':'')+'>'+esc(txt('A new source…','Yeni bir kaynak…'))+'</option></select>';
  if(LOGF.src==="new"||!logSrc(LOGF.src))
    h+='<input class="inp" id="logname" autocomplete="off" placeholder="'+esc(txt('Its name','Adı'))+'" value="'+esc(LOGF.name)+'">'+
      '<input class="inp" id="logurl" autocomplete="off" inputmode="url" placeholder="'+esc(txt('A link, if you like','İstersen bir bağlantı'))+'" value="'+esc(LOGF.url)+'">';
  h+='<p class="tiny">'+tx('How much did you understand?','Ne kadarını anladın?')+'</p><div class="segs">'+
    LOG_UND.map(function(u,i){return logSeg("und",i,u[0],u[1]);}).join('')+'</div>';
  h+='<p class="tiny">'+tx('When?','Ne zaman?')+'</p><div class="segs">'+
    logSeg("ago",0,"bugün","today")+logSeg("ago",1,"dün","yesterday")+logSeg("ago",2,"önceki gün","the day before")+'</div>';
  h+='<p class="tiny" id="logmsg" role="status"></p><div class="btn-row"><button class="btn ghost" onclick="logCancel()">Vazgeç</button>'+
    '<button class="btn" onclick="logSave()">Kaydet</button></div></div>';
  return h;
}
function logWhen(d){const k=dayNum()-d;return k<=0?"bugün":k===1?"dün":k+" gün önce";}
function renderLog(){
  const st=logStore(), tot=logTotal(), mark=logNextMark();
  let h=bar("Dinleme günlüğü","listening outside the app",true,"uygulamanın dışında")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('This app is a few thousand sentences in one synthetic voice. What turns a course into a language is hours of real Turkish just above your level: podcasts, videos, television, books, people. The app cannot give you those hours, but it can count them. Log each sitting here.',
    'Bu uygulama tek bir yapay seste birkaç bin cümle. Bir kursu dile çeviren, seviyenin biraz üstünde saatlerce gerçek Türkçedir: podcast’ler, videolar, televizyon, kitaplar, insanlar. Uygulama sana o saatleri veremez ama sayabilir. Her oturumu buraya yaz.')+'</p>';
  h+=logNote();
  h+='<div class="stat"><div><b>'+logH(tot)+'</b><span>'+tx('in all','toplam')+'</span></div>'+
     '<div><b>'+logH(logSince(7))+'</b><span>'+tx('last 7 days','son 7 gün')+'</span></div>'+
     '<div><b>'+logStreak()+'</b><span>'+tx('days in a row','gün üst üste')+'</span></div></div>';
  if(LOGF)h+=logForm();
  else h+='<button class="btn" onclick="logNew()">Kaydet · log a sitting</button>';
  if(mark){
    const pct=Math.min(100,Math.round(100*tot/(mark*60)));
    h+='<div class="prow" style="margin:.4rem .2rem 0"><div class="row"><span class="grow tiny">'+
      tx('Next round number: '+mark+' hours','Sıradaki eşik: '+mark+' saat')+'</span><b class="tiny">'+pct+'%</b></div>'+
      '<div class="meter"><i style="width:'+pct+'%"></i></div></div>';
  }
  /* The last fortnight, as bars: enough to see a habit, no more. */
  const days=[]; for(let k=13;k>=0;k--)days.push(logDay(dayNum()-k));
  const top=Math.max(30,Math.max.apply(null,days));
  h+='<h2 class="sec">Son iki hafta</h2><div class="card"><div class="lbars" aria-label="'+esc(txt('minutes a day, last 14 days','son 14 gün, günde dakika'))+'">'+
    days.map(function(m,i){return '<i title="'+m+' dk" style="height:'+Math.round(100*m/top)+'%"'+(i===13?' class="now"':'')+'></i>';}).join('')+
    '</div><p class="tiny" style="margin:.4rem 0 0">'+tx('Aim for “most” understood: enough to follow, with something left to learn. “A little” for long is mostly noise; “nearly all” is review.',
      '“Çoğu”nu anlamayı hedefle: takip edecek kadar, öğrenecek bir şey kalacak kadar. Uzun süre “az” çoğunlukla gürültüdür; “hepsi” tekrardır.')+'</p></div>';
  h+='<button class="btn ghost" onclick="mineOpen()">Bir kelime mi yakaladın? · caught a word?</button>';
  if(st.e.length){
    h+='<h2 class="sec">Son kayıtlar</h2><div class="card">';
    /* Newest day first; a backdated entry sits with its day. */
    st.e.slice().sort(function(a,b){return (b.day-a.day)||(Number(b.id.slice(1))-Number(a.id.slice(1)));}).slice(0,20).forEach(function(x){
      const k=LOG_KINDS.find(function(z){return z[0]===x.kind;}), u=LOG_UND[x.und];
      h+='<div class="prow"><div class="row" style="gap:.4rem"><span class="grow"><b>'+esc(logHM(x.min))+'</b> · '+esc(x.nm)+
        '<span class="tiny" style="display:block">'+esc((k?k[1]:"")+(u?' · '+u[0]:''))+'</span></span>'+
        '<span class="tiny">'+logWhen(x.day)+'</span><button class="sbtn" onclick="logDel(\''+x.id+'\')">×</button></div></div>';
    });
    h+='</div>';
  }
  if(st.src.length){
    h+='<h2 class="sec">Kaynaklarım</h2><div class="card">';
    st.src.forEach(function(s){
      h+='<div class="prow"><div class="row" style="gap:.4rem"><span class="grow">'+
        (s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+'</a>':esc(s.name))+
        '</span><b class="tiny">'+esc(logHM(logSrcMin(s.id)))+'</b><button class="sbtn" onclick="logSrcDel(\''+s.id+'\')">×</button></div></div>';
    });
    h+='</div>';
  }
  h+='<p class="foot">'+tx('A record, not a lesson: nothing here is scheduled or marked. The round numbers are only that; hours are a rough measure, and what you understood matters more than how long it ran.',
    'Bir kayıt, bir ders değil: burada hiçbir şey sıraya konmaz ya da değerlendirilmez. Eşikler yalnızca yuvarlak sayılar; saat kaba bir ölçüdür ve ne kadar anladığın, ne kadar sürdüğünden önemlidir.')+'</p></div>';
  paint(h);
}
