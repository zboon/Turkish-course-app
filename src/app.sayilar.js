/* Sayılar: numbers, times and prices at the speed a shop demands. */

/* ===================== sayılar · numbers at speed ===================== */
/* The thing that reliably fails in a real shop is not vocabulary. It is
   that someone says "yüz yetmiş beş lira" and the conversion does not
   arrive in time. Accuracy is not the problem — given ten seconds almost
   anyone gets it — so this mode measures the one thing that matters and
   the course never tested: **latency**.

   Two consequences, and they are the whole design:

   1. **The clock is part of the mark.** Right but slow does not advance a
      box. A number you worked out in nine seconds is a number you cannot
      use, and a drill that calls that a pass is lying to the learner.
      `S.ncap` is the bar and can be turned off, but it is on by default.
   2. **Nothing here is written down.** Turkish numbers are perfectly
      regular, so every prompt is generated: there is no list to memorise
      and no content to keep honest. What is scheduled is the *shape* —
      three digits, thousands, the clock, a price — because that is what a
      learner is weak at.

   Hearing is also the app's **second objective judge**, after Dikte.
   Everything else outside those two is self-graded, and self-grading
   cannot see a number you misheard: 60 and 70 (altmış / yetmiş) sound
   alike at speed and a learner who hears the wrong one is certain they
   were right. A typed digit either is or is not 342. */

const NUM_ONES=["","bir","iki","üç","dört","beş","altı","yedi","sekiz","dokuz"];
const NUM_TENS=["","on","yirmi","otuz","kırk","elli","altmış","yetmiş","seksen","doksan"];
const NUM_SCALE=["","bin","milyon","milyar"];

/* 0–999, the group every larger number is built from. */
function numUnder1000(n){
  const out=[], h=Math.floor(n/100), t=Math.floor((n%100)/10), o=n%10;
  /* 100 is "yüz", not "bir yüz" — the dropped bir is the commonest
     learner error in the whole system, and 200 keeps it. */
  if(h)out.push(h===1?"yüz":NUM_ONES[h]+" yüz");
  if(t)out.push(NUM_TENS[t]);
  if(o)out.push(NUM_ONES[o]);
  return out.join(" ");
}
/* Turkish numbers are pure concatenation — no "and", no hyphen, largest
   group first. The one asymmetry worth knowing is that bin drops its bir
   (1000 is "bin") while milyon keeps it ("bir milyon"). */
function numText(n){
  n=Math.floor(n);
  if(n<0)return "eksi "+numText(-n);
  if(n===0)return "sıfır";
  const out=[];
  let rest=n;
  for(let s=3;s>=1;s--){
    const base=Math.pow(1000,s), g=Math.floor(rest/base);
    if(!g)continue;
    rest-=g*base;
    const head=(g===1&&s===1)?"":numUnder1000(g);
    out.push((head?head+" ":"")+NUM_SCALE[s]);
  }
  if(rest)out.push(numUnder1000(rest));
  return out.join(" ");
}

/* --- the clock -------------------------------------------------------- */
/* Past the hour takes the accusative, before it the dative, and both are
   built by the same morphology the drills use rather than a second table:
   dört is the only awkward one (dördü, dörde) and its soft flag says so. */
const HOUR_E=[null,{t:"bir"},{t:"iki"},{t:"üç"},{t:"dört",soft:1},{t:"beş"},
              {t:"altı"},{t:"yedi"},{t:"sekiz"},{t:"dokuz"},{t:"on"},
              {t:"on bir"},{t:"on iki"}];
function hourWord(h){return HOUR_E[h].t;}
function hourAcc(h){return nAcc(HOUR_E[h]);}
function hourDat(h){return nDat(HOUR_E[h]);}
function nextHour(h){return h===12?1:h+1;}
/* The four shapes a1u6 teaches, and nothing else: on the hour, half past,
   past (to 30), and to (after 30). Minutes are multiples of five because
   that is what anyone actually says. */
function timeText(h,m){
  if(m===0)return "saat "+hourWord(h);
  if(m===30)return hourWord(h)+" buçuk";
  if(m<30)return hourAcc(h)+" "+(m===15?"çeyrek":numText(m))+" geçiyor";
  const left=60-m;
  return hourDat(nextHour(h))+" "+(left===15?"çeyrek":numText(left))+" var";
}

/* --- prices ----------------------------------------------------------- */
function priceText(l,k){
  if(!l)return numText(k)+" kuruş";
  return numText(l)+" lira"+(k?" "+numText(k)+" kuruş":"");
}

/* --- reading the learner's answer -------------------------------------- */
/* Digits, not words: the answer to a heard number is a number, which is
   exactly what makes this markable. Separators are forgiven because a
   Turkish keyboard writes 1.234 and an English one 1,234. */
function numClean(s){return String(s==null?"":s).replace(/\s+/g,"").trim();}
function parsePlain(s){
  const t=numClean(s).replace(/[.,]/g,"");
  return /^\d+$/.test(t)?parseInt(t,10):null;
}
function parseTime(s){
  const t=numClean(s);
  let m=/^(\d{1,2})[:.,\-](\d{1,2})$/.exec(t);
  if(!m&&/^\d{3,4}$/.test(t))m=[t,t.slice(0,t.length-2),t.slice(-2)];
  if(!m)return null;
  let h=parseInt(m[1],10), mi=parseInt(m[2],10);
  if(mi>59||h>23)return null;
  /* 15:20 and 3:20 are one answer: the spoken Turkish does not
     distinguish them, so neither may the judge. 27:20 is not a time. */
  h=h%12; if(h===0)h=12;
  return [h,mi];
}
function parsePrice(s){
  const t=numClean(s).replace(/tl|lira|₺/ig,"");
  const m=/^(\d+)[.,](\d{1,2})$/.exec(t);
  if(m)return [parseInt(m[1],10),parseInt((m[2]+"0").slice(0,2),10)];
  if(/^\d+$/.test(t))return [parseInt(t,10),0];
  return null;
}

/* --- what a sitting is made of ---------------------------------------- */
/* Scheduled by shape rather than by number, for the same reason the
   generated drills are: the numbers are endless, but "thousands" is a
   thing you can be weak at and "342" is not. */
const NUM_BANDS=[
 {k:"2",   tr:"iki basamak", en:"10–99",      lo:10,   hi:99},
 {k:"3",   tr:"üç basamak",  en:"100–999",    lo:100,  hi:999},
 {k:"4",   tr:"binler",      en:"1.000–9.999",lo:1000, hi:9999},
 {k:"6",   tr:"büyük sayı",  en:"10.000+",    lo:10000,hi:999999},
 {k:"saat",tr:"saat",        en:"the clock"},
 {k:"fiyat",tr:"fiyat",      en:"prices"}
];
/* The ceiling, by how many digits it lets through — "1000k" is what
   rounding 999.999 to thousands produced, and a control that cannot say
   what it selects is worse than no control. */
const NUM_MAX=[99,999,9999,999999];
const NUM_MAX_LAB=[["2","tens"],["3","hundreds"],["4","thousands"],["6","big"]];
const NUM_CAPS=[3,5,8,0];            /* 0 turns the clock off */
const NUM_SESSION=12;
function nmax(){return S.nmax||999;}
function setNmax(n){S.nmax=n;save();render();}
function ncap(){return S.ncap===0?0:(S.ncap||5);}
function setNcap(n){S.ncap=n;save();render();}

/* Every band up to the ceiling, plus the clock and prices — those two are
   not sizes and are always in play. */
function numBands(){
  const top=nmax();
  return NUM_BANDS.filter(function(b){
    return b.lo===undefined||b.lo<=top;
  });
}
function numRand(lo,hi){return lo+Math.floor(Math.random()*(hi-lo+1));}
/* One prompt: the Turkish that is said or revealed, and the digits that
   are the answer. `show` is what a learner reads back in the say-it
   direction — 3:15 rather than 195 minutes. */
function numSpec(b){
  if(b.k==="saat"){
    const h=numRand(1,12), m=pick([0,0,5,10,15,20,25,30,30,35,40,45,50,55]);
    return {band:b.k,kind:"saat",tr:timeText(h,m),
            show:h+":"+String(m).padStart(2,"0"),val:[h,m]};
  }
  if(b.k==="fiyat"){
    const top=Math.min(nmax(),9999);
    const l=numRand(1,top), k=pick([0,0,0,25,50,75,5,10,90]);
    return {band:b.k,kind:"fiyat",tr:priceText(l,k),
            show:l+(k?","+String(k).padStart(2,"0"):"")+" TL",val:[l,k]};
  }
  const n=numRand(b.lo,Math.min(b.hi,nmax()));
  return {band:b.k,kind:"sayi",tr:numText(n),show:String(n),val:n};
}
/* Right or wrong, by the kind's own parser. A number is the one answer in
   this app that can be marked without asking the learner. */
function numJudge(sp,typed){
  if(sp.kind==="saat"){
    const g=parseTime(typed);
    return !!g&&g[0]===sp.val[0]&&g[1]===sp.val[1];
  }
  if(sp.kind==="fiyat"){
    const g=parsePrice(typed);
    return !!g&&g[0]===sp.val[0]&&g[1]===sp.val[1];
  }
  const g=parsePlain(typed);
  return g!==null&&g===sp.val;
}
function numKey(mode,band){return mode+":"+band;}
function numBank(mode){
  const bands=numBands(), out=[];
  /* Reviews first, oldest due first — the same shape every other mode
     uses, over a bank of shapes rather than sentences. */
  const due=dueQueue(S.num,bands.map(function(b){
    return {k:numKey(mode,b.k),b:b};
  }),bands.length);
  const pool=due.length?due:bands.map(function(b){return {k:numKey(mode,b.k),b:b};});
  for(let i=0;i<NUM_SESSION;i++){
    const it=pool[i%pool.length];
    const sp=numSpec(it.b);
    sp.k=it.k;sp.lab=it.b.tr;sp.en=it.b.en;
    out.push(sp);
  }
  return out;
}
function numGrade(k,good){
  if(!S.num)S.num={};
  bump(S.num,k,function(b){return good?b+1:0;});
  save();
}
function numDue(mode){
  return numBands().filter(function(b){return isDue(S.num,numKey(mode,b.k));}).length;
}

/* --- the run ----------------------------------------------------------- */
/* NM holds a sitting and, like VOICE and PR, has to survive a re-render. */
let NM=null;
function startNum(mode){
  stopPlay();
  if(mode==="duy"&&!ttsOK()){V={view:"sayilar"};render();return;}
  const q=numBank(mode);
  if(!q.length){V={view:"sayilar"};render();return;}
  /* No timer of its own: the only asynchronous thing here is the voice,
     and stopPlay() already cancels that. t0 is a stopwatch, not a
     countdown, so there is nothing for stopPlay to clear. */
  NM={mode:mode,q:q,i:0,phase:"ask",typed:"",res:null,right:0,fast:0,t0:0,ms:[]};
  V={view:"sayilarrun"};window.scrollTo(0,0);
  touchDay();numStep();
}
function numStep(){
  if(!NM)return;
  const it=NM.q[NM.i];
  if(!it){NM.phase="end";render();return;}
  NM.phase="ask";NM.typed="";NM.res=null;
  render();
  /* The clock starts when the prompt is available, which in the hearing
     direction is when it finishes being said rather than when the screen
     paints — otherwise a long number is penalised for its own length. */
  if(NM.mode==="duy")numSay(true);
  else NM.t0=Date.now();
}
function numSay(first){
  if(!NM)return;
  const it=NM.q[NM.i]; if(!it)return;
  numKeep();
  const started=Date.now();
  /* 1x, always: a slower voice would make the clock meaningless, and
     normal pace is the thing being trained for. */
  say(it.tr,1,function(){
    if(NM&&first)NM.t0=Date.now();
  });
  /* A browser that never fires onend must not leave the clock unstarted. */
  if(first)NM.t0=started+yolDur(it.tr);
}
function numKeep(){
  const box=document.getElementById("nbox");
  if(box&&NM)NM.typed=box.value;
}
function numElapsed(){return NM&&NM.t0?Math.max(0,Date.now()-NM.t0):0;}
function numCheck(){
  if(!NM)return;
  const it=NM.q[NM.i]; if(!it)return;
  numKeep();
  const ms=numElapsed();
  const ok=numJudge(it,NM.typed);
  /* Right but slow is not a pass. The cap is the whole point of the mode
     and can be switched off, but switching it off is a decision the
     learner makes rather than one the drill makes for them. */
  const cap=ncap();
  const quick=cap===0||ms<=cap*1000;
  NM.res={ok:ok,ms:ms,quick:quick};
  NM.ms.push(ms);
  if(ok)NM.right++;
  if(ok&&quick)NM.fast++;
  numGrade(it.k,ok&&quick);
  if(!ok)numNote(it,NM.typed);
  NM.phase="check";render();
}
/* One shape for both directions, so the book reads the same either way:
   what you were given, what the answer was, and which shape it is —
   the key is the shape too, so "three digits, eleven times" is a
   sentence this can now say. */
function numNote(it,given){
  const duy=NM&&NM.mode==="duy";
  errNote("n:"+it.k,{m:"n",q:duy?it.tr:it.show,c:duy?it.show:it.tr,
                     a:String(given||""),w:it.lab+" · "+it.en});
}
function numReveal(){
  if(!NM)return;
  const it=NM.q[NM.i]; if(!it)return;
  const ms=numElapsed();
  NM.res={ok:null,ms:ms,quick:ncap()===0||ms<=ncap()*1000};
  NM.ms.push(ms);
  NM.phase="check";render();
  say(it.tr);
}
/* The say-it direction is self-graded, like everything else that leaves no
   typed evidence — but the clock was already running, so slow still
   counts as slow. */
function numMark(good){
  if(!NM)return;
  const it=NM.q[NM.i]; if(!it)return;
  const quick=NM.res?NM.res.quick:true;
  NM.res.ok=good;
  if(good)NM.right++;
  if(good&&quick)NM.fast++;
  numGrade(it.k,good&&quick);
  if(!good)numNote(it,"");
  numNext();
}
function numNext(){
  if(!NM)return;
  NM.i++;window.scrollTo(0,0);
  if(NM.i>=NM.q.length){NM.phase="end";render();return;}
  numStep();
}
function numMedian(){
  if(!NM||!NM.ms.length)return 0;
  const a=NM.ms.slice().sort(function(x,y){return x-y;});
  const h=Math.floor(a.length/2);
  return a.length%2?a[h]:Math.round((a[h-1]+a[h])/2);
}
function secs(ms){return (ms/1000).toFixed(1);}

/* --- screens ----------------------------------------------------------- */
function renderSayilar(){
  const cap=ncap(), top=nmax();
  let h=bar("Sayılar","numbers · at speed",true)+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">Turkish numbers are perfectly regular, so knowing them is not the problem — getting them in time is. Someone says a price and you have a second or two, not ten. These are generated, so there is nothing to memorise: what comes back is the <b>shape</b> you are slow at.</p>';

  h+='<div class="stat"><div><b>'+numDue("duy")+'</b><span>duyma</span></div>'+
     '<div><b>'+numDue("oku")+'</b><span>söyleme</span></div>'+
     '<div><b>'+(cap?cap+"s":"—")+'</b><span>hedef</span></div></div>';

  h+='<h2 class="sec">Çalış</h2>';
  if(ttsOK()){
    h+='<div class="card"><p class="lead">Duy · write the digits</p>'+
     '<p class="sub">A number, a time or a price is said once and you type it. This is the shop: <i>altmış</i> and <i>yetmiş</i> sound alike at speed, and self-grading cannot catch a number you misheard — so the app marks this one, like Dikte.</p>'+
     '<button class="btn" onclick="startNum(\'duy\')">Başla</button></div>';
  }else{
    h+='<div class="card"><p class="lead">Duy</p><p class="sub">This browser has no speech synthesis, so there is nothing to hear. The other direction still works.</p></div>';
  }
  h+='<div class="card"><p class="lead">Söyle · read it out</p>'+
   '<p class="sub">The digits are on screen and you say the Turkish out loud before the model plays — the Üretim shape, with a clock on it. You mark yourself, but the clock is not yours to argue with.</p>'+
   '<button class="btn" onclick="startNum(\'oku\')">Başla</button></div>';

  h+='<h2 class="sec">Ayarlar</h2><div class="card">';
  h+='<p class="lead" style="font-size:.95rem">Ne kadar büyük · how high</p>'+
   '<p class="sub">The clock and prices are always in play; this sets the ceiling on plain numbers.</p><div class="segs">';
  NUM_MAX.forEach(function(n,i){
    h+='<button class="'+(n===top?"on":"")+'" onclick="setNmax('+n+')">'+
     NUM_MAX_LAB[i][0]+' basamak<i>'+NUM_MAX_LAB[i][1]+'</i></button>';
  });
  h+='</div>';
  h+='<p class="lead" style="font-size:.95rem">Hedef süre · the bar</p>'+
   '<p class="sub">Right but slow does not move a box out. That is the whole mode — a number you worked out in nine seconds is one you cannot use. Turn it off and this becomes an ordinary drill.</p><div class="segs">';
  NUM_CAPS.forEach(function(n){
    h+='<button class="'+(n===cap?"on":"")+'" onclick="setNcap('+n+')">'+(n===0?"—":n+"s")+
     '<i>'+(n===0?"kapalı":n<=3?"zor":n<=5?"normal":"rahat")+'</i></button>';
  });
  h+='</div></div>';

  h+='<h2 class="sec">Şekiller</h2><div class="card">';
  h+='<p class="sub" style="margin-bottom:.6rem">Weakest first. A shape missed — or got right too slowly — comes back today.</p>';
  numBands().slice().sort(function(a,b){
    const x=(S.num&&S.num[numKey("duy",a.k)]||{b:-1}).b, y=(S.num&&S.num[numKey("duy",b.k)]||{b:-1}).b;
    return x-y;
  }).forEach(function(b){
    const r=S.num&&S.num[numKey("duy",b.k)];
    h+='<div class="vrow"><div class="grow"><div class="vtr" style="font-size:.97rem">'+esc(b.tr)+'</div>'+
      '<div class="ven">'+esc(b.en)+' · '+(r?"kutu "+r.b:"hiç sorulmadı")+'</div></div>'+
      '<span class="pill" style="flex:0 0 auto">'+esc(numSpec(b).show)+'</span></div>';
  });
  h+='</div>';

  h+='<p class="foot">Yüz is “yüz”, never “bir yüz” — and bin is “bin”, but a million keeps its bir.<br>Every prompt is built on the spot, so the set never runs out.</p></div>';
  app().innerHTML=h;
}

function renderSayilarRun(){
  if(!NM){renderSayilar();return;}
  const duy=NM.mode==="duy";
  if(NM.phase==="end"){
    const med=numMedian(), cap=ncap();
    app().innerHTML=bar("Sayılar","Bitti",true)+'<div class="wrap"><div class="score">'+
      '<div class="big '+(NM.fast*2>=NM.q.length?"pass":"fail")+'">'+NM.fast+'/'+NM.q.length+'</div>'+
      '<p class="sub">'+(cap?"doğru ve zamanında · right and in time":"doğru · right")+'</p></div>'+
      '<div class="stat"><div><b>'+NM.right+'</b><span>doğru</span></div>'+
      '<div><b>'+secs(med)+'s</b><span>ortanca</span></div>'+
      '<div><b>'+(cap?cap+"s":"—")+'</b><span>hedef</span></div></div>'+
      '<div class="card"><p class="sub">'+
      (cap?'The median is the number to watch: accuracy climbs long before speed does, and a shop gives you about two seconds. Anything right but over '+cap+'s stays where it was.'
          :'The clock is off, so this was marked on accuracy alone.')+'</p>'+
      '<button class="btn" onclick="startNum(\''+NM.mode+'\')">Devam</button>'+
      '<button class="btn ghost" onclick="go(\'sayilar\')">Sayılar</button></div></div>';
    return;
  }
  const it=NM.q[NM.i];
  let h=bar("Sayılar",(NM.i+1)+" / "+NM.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+NM.q.map(function(_,i){return '<i class="'+(i<NM.i?"ok":"")+'"></i>';}).join('')+'</div>';
  h+='<p class="qn">'+(duy?"Duy ve yaz · type what you hear":"Söyle · read it out loud")+'</p>';

  if(NM.phase==="ask"){
    if(duy){
      h+='<div class="card" style="text-align:center;padding:1.6rem 1rem">'+
       '<button class="sbtn" style="font-size:1rem" onclick="numSay(false)">'+IC.spk+' tekrar dinle</button>'+
       '<p class="tiny" style="margin:.5rem 0 0">nothing is shown — the clock is running</p></div>';
      h+='<input class="inp" id="nbox" inputmode="decimal" autocapitalize="off" autocomplete="off" '+
       'autocorrect="off" spellcheck="false" placeholder="'+
       (it.kind==="saat"?"3:15":it.kind==="fiyat"?"42,50":"342")+'" value="'+esc(NM.typed||"")+'">'+
       '<button class="btn" onclick="numCheck()">Kontrol et</button>';
    }else{
      h+='<div class="card" style="text-align:center;padding:2rem 1rem">'+
       '<p class="mark" style="font-size:3rem;margin:0;line-height:1.1">'+esc(it.show)+'</p>'+
       '<p class="tiny" style="margin-top:.6rem">Şimdi yüksek sesle · out loud now</p></div>';
      h+='<button class="btn" onclick="numReveal()">Göster</button>';
    }
  }else{
    const r=NM.res;
    h+='<div class="card" style="text-align:center;padding:1.4rem 1rem">'+
     '<p class="mark" style="font-size:2.2rem;margin:0;line-height:1.1">'+esc(it.show)+'</p>'+
     '<p style="font-family:\'Crimson Pro\',serif;font-size:1.45rem;margin:.4rem 0 0;color:var(--turk)">'+esc(it.tr)+'</p>'+
     '<button class="sbtn" style="margin-top:.4rem" onclick="numSay(false)">'+IC.spk+' tekrar</button></div>';
    h+='<div class="row" style="margin:.6rem .2rem"><span class="tiny grow">'+esc(it.lab)+' · '+esc(it.en)+'</span>'+
     '<span class="pill '+(r.quick?"turk":"bole")+'">'+secs(r.ms)+'s'+(ncap()?" / "+ncap()+"s":"")+'</span></div>';
    if(duy){
      h+='<div class="fb '+(r.ok&&r.quick?"ok":"no")+'"><b>'+
       (r.ok?(r.quick?"Doğru":"Doğru, ama geç"):"Yanlış")+'</b>'+
       (r.ok?(r.quick?"It comes back later and later from here."
                    :"The digits were right and the clock was not, so this shape comes back today. Speed is the skill here.")
            :"You typed "+esc(NM.typed||"—")+". Wrong numbers come back today.")+'</div>';
      h+='<button class="btn" onclick="numNext()">'+(NM.i+1>=NM.q.length?"Sonuç":"Devam")+'</button>';
    }else{
      h+='<div class="btn-row"><button class="btn ghost" onclick="numMark(false)">Yanlış</button>'+
       '<button class="btn" onclick="numMark(true)">Doğru</button></div>';
      if(!r.quick)h+='<p class="tiny" style="text-align:center;margin-top:.5rem">Over the bar, so even a right answer leaves this shape where it is.</p>';
    }
  }
  h+='</div>';
  app().innerHTML=h;
  const box=document.getElementById("nbox");
  if(box){
    box.focus();
    box.addEventListener("keydown",function(e){if(e.key==="Enter")numCheck();});
  }
}
