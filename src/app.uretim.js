/* Üretim: production practice. Prompt, silence, model, self-grade —
   plus the chunk bank, the generated drills' runner and the spaced
   retell. */

/* ===================== üretim · production ===================== */
/* Pimsleur's one move: the sentence has to leave your mouth before the
   model is heard. English prompt, a silent gap, then the Turkish and the
   learner's own verdict. No microphone — self-grading is what keeps it
   working offline with nothing to permit. Scheduling reuses STEPS, the
   same ladder the word queue climbs.
   PR holds a run and, like VOICE and Q, must survive a re-render. */
const GAPS=[3,4,5,6];
const SESSION=12;
const RETELL_NEXT=[0,2,4,0];        /* told on day 1, then 3, then 7 */
let PR=null;

function prodGap(){return S.gap||4;}
function setGap(n){S.gap=n;save();render();}
function togglePrompt(){S.prompten=!S.prompten;save();render();}
function pscope(){return S.pscope||"done";}
function setScope(s){S.pscope=s;save();render();}

/* Keys are permanent, like unit ids: "s:<unitId>#<line>" and "k:<n>". */
function sayable(t){return String(t).replace(/^[—–-]\s*/,"").trim();}
function sentenceBank(){
  const sc=pscope(), here=S.place&&S.place.u, out=[];
  let us=UNITS.filter(function(u){return sc==="all"?true:sc==="unit"?u.id===here:isDone(u.id);});
  /* Nothing finished yet: fall back to what has at least been read, and to
     nothing at all if that is nothing. The old fallback handed out the
     first three units regardless, so a learner on day one was asked to
     produce sentences from passages they had not opened. "Tümü" stays a
     deliberate choice and is left alone. */
  if(!us.length&&sc!=="all")us=UNITS.filter(function(u){return metLines(u.id);});
  us.forEach(function(u){
    u.read.lines.forEach(function(ln,i){
      out.push({k:"s:"+u.id+"#"+i,tr:sayable(ln[0]),en:ln[1],lv:u.lv,from:u.tr});
    });
  });
  return out;
}
function chunkBank(){
  return CHUNKS.map(function(c,i){return {k:"k:"+i,tr:c[0],en:c[1],lv:"Kalıp",from:"günlük konuşma"};});
}
/* Reviews first, oldest due first; new sentences stay in course order,
   so the mode walks the material rather than sampling it at random, and
   come in no faster than NEW_DAY.prod a day, counted per bank: prefabs
   and passage lines each have their own allowance. */
function prodDue(bank){
  const pfx=bank.length?bank[0].k.slice(0,bank[0].k.indexOf(":")+1):"";
  return dueItems(S.prod,bank,NEW_DAY.prod,pfx);
}
function prodQueue(bank){return prodDue(bank).slice(0,SESSION);}
function prodGradeKey(k,good){
  if(!S.prod)S.prod={};
  bump(S.prod,k,function(b){return good?b+1:0;});
  save();
}

/* Backward buildup. The verb lands last in Turkish and holding the shape
   until it arrives is exactly what breaks fluency, so the tail is drilled
   first and grown leftwards:
   bilmiyorum → ne dediğini bilmiyorum → adamın ne dediğini bilmiyorum.
   Boundaries are commas, clause-opening words, and the converb and
   participle endings that close a subordinate clause. Tested folded, so
   the suffixes are written in their folded spelling. */
const OPENERS=["ne","kim","nasil","neden","niye","nicin","kac","hangi","nerede","nereye","nereden","eger","cunku","ama","fakat"];
/* Postpositions close the phrase before them, so the break goes after,
   never before: "bir süre sonra | Hoca…", not "…süre | sonra Hoca…". */
const POSTPOS=["icin","gibi","diye","sonra","once","kadar","gore","ile","ki","dolayi","beri"];
/* And nothing may open on a clitic — de/da/mi lean on the word to their left. */
const CLITIC=["de","da","ki","mi","mu","ise","bile","dahi"];
const CONVERB=/(ip|up|erek|arak|ince|inca|unca|unce|ken|madan|meden|digi|dugu|tigi|tugu|acagi|ecegi)(ni|nu|na|ne|n|)$/;
function clauseSplit(t){
  const s=sayable(t), w=s.split(/\s+/);
  if(w.length<4)return [s];
  const starts=[];
  for(let i=1;i<w.length;i++){
    const prev=fold(w[i-1]), cur=fold(w[i]);
    if(CLITIC.indexOf(cur)>-1)continue;
    if(/[,;:]$/.test(w[i-1])||OPENERS.indexOf(cur)>-1||POSTPOS.indexOf(prev)>-1||CONVERB.test(prev))starts.push(i);
  }
  /* The verb, standing alone — but never a bare clitic, so a sentence
     ending "… var mı?" starts from "var mı?" rather than "mı?". */
  let last=w.length-1;
  while(last>0&&(CLITIC.indexOf(fold(w[last]))>-1||POSTPOS.indexOf(fold(w[last]))>-1))last--;
  starts.push(last);
  const tails=[];
  starts.sort(function(x,y){return y-x;}).forEach(function(i){
    const t2=w.slice(i).join(" ");
    if(tails.indexOf(t2)<0)tails.push(t2);
  });
  const out=tails.slice(0,3);
  if(out.indexOf(s)<0)out.push(s);
  return out;
}

/* Generated drills are scheduled by PATTERN, not by sentence: the
   sentences are endless, but "the future negative" is a thing you can be
   weak at, and that is what should come back. */
function genBank(){
  const out=[];
  for(let i=0;i<SESSION;i++){
    const s=makeSpec(pick(KINDS)), r=specText(s);
    out.push({k:"g:"+s.f+":"+s.t,tr:r.tr,en:r.en,lv:"Kurma",from:r.lab});
  }
  return out;
}
function moveBank(){
  const out=[];
  for(let i=0;i<SESSION*3&&out.length<SESSION;i++){
    const m=makeMove();
    if(!m)continue;
    out.push({k:"t:"+m.move.k,tr:m.to.tr,en:m.to.en,lv:"Dönüştürme",from:m.to.lab,
              given:m.from.tr,instr:m.move.tr+" · "+m.move.en});
  }
  return out;
}

/* --- the run --------------------------------------------------------- */
function prodStop(){if(PR&&PR.tid){clearTimeout(PR.tid);PR.tid=null;}}
function startProd(mode){
  stopPlay();
  const q=mode==="g"?genBank():mode==="t"?moveBank()
         :mode==="q"?sorBank():mode==="e"?askBank()
         :prodQueue(mode==="k"?chunkBank():sentenceBank());
  if(!q.length){V={view:"prod"};render();return;}
  /* Sor rides this runner but is not Üretim, and a sitting that calls
     itself by the wrong name is the sort of small lie that makes a
     learner distrust the rest. */
  PR={mode:mode,q:q,i:0,phase:"gap",left:prodGap(),tid:null,right:0,build:null,bi:0,
      title:(mode==="q"||mode==="e")?"Sor":"Üretim"};
  V={view:"prodrun"};window.scrollTo(0,0);
  touchDay();prodStep();
}
function prodStep(){
  if(!PR)return;
  const it=PR.q[PR.i];
  if(!it){PR.phase="end";render();return;}
  PR.phase="gap";PR.left=prodGap();PR.build=null;PR.bi=0;
  render();
  if(S.prompten)say(it.en,0.95,null,"en-GB");
  prodCount();
}
function prodCount(){
  if(!PR||PR.phase!=="gap")return;
  const el=document.getElementById("pcount");
  if(el)el.textContent=PR.left;
  if(PR.left<=0){prodModel();return;}
  PR.tid=setTimeout(function(){if(!PR||PR.phase!=="gap")return;PR.left--;prodCount();},1000);
}
function prodModel(){
  prodStop();
  if(!PR)return;
  PR.phase="model";render();
  const it=PR.q[PR.i];if(it)say(it.tr);
}
function prodSay(){const it=PR&&PR.q[PR.i];if(it)say(it.tr);}
function prodMark(good){
  const it=PR&&PR.q[PR.i];if(!it)return;
  prodGradeKey(it.k,good);
  if(good)PR.right++;
  else errNote(it.k,{m:"s",q:it.en,c:it.tr,to:errUnitOf(it.k)});
  /* A sentence you could not produce is the one worth building up. */
  if(!good&&clauseSplit(it.tr).length>1){prodBuild();return;}
  prodNext();
}
function prodBuild(){
  prodStop();
  if(!PR)return;
  PR.phase="build";PR.build=clauseSplit(PR.q[PR.i].tr);PR.bi=0;
  render();say(PR.build[0]);
}
function prodBuildNext(){
  if(!PR||!PR.build)return;
  PR.bi++;
  if(PR.bi>=PR.build.length){prodNext();return;}
  render();say(PR.build[PR.bi]);
}
function prodNext(){
  prodStop();
  if(!PR)return;
  PR.i++;window.scrollTo(0,0);
  if(PR.i>=PR.q.length){PR.phase="end";render();return;}
  prodStep();
}

/* --- say it three times ---------------------------------------------- */
function retellDue(){
  const n=dayNum();
  return UNITS.filter(function(u){const r=S.retell&&S.retell[u.id];return r&&r.n<3&&r.d<=n;});
}
function retellOpen(){
  return UNITS.filter(function(u){const r=S.retell&&S.retell[u.id];return r&&r.n<3;});
}
function startRetell(uid){
  stopPlay();
  if(!S.retell)S.retell={};
  if(!S.retell[uid])S.retell[uid]={n:0,d:dayNum()};
  save();V={view:"retell",u:uid};window.scrollTo(0,0);render();
}
function retellDone(uid){
  const r=(S.retell&&S.retell[uid])||{n:0,d:dayNum()};
  r.n=Math.min(r.n+1,3);
  r.d=dayNum()+RETELL_NEXT[r.n];
  S.retell[uid]=r;save();touchDay();render();
}
function retellReset(uid){S.retell[uid]={n:0,d:dayNum()};save();render();}

/* --- screens ---------------------------------------------------------- */
function renderProd(){
  const sb=sentenceBank(), sd=prodDue(sb).length, kd=prodDue(chunkBank()).length;
  const rd=retellDue().length, open=retellOpen(), g=prodGap();
  let h=bar("Üretim","production · speak first",true,"önce sen söyle")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('The prompt is English. You say the Turkish out loud in the silence, <b>before</b> the model plays — then mark yourself. Nothing is recorded and no microphone is used.',
    'İngilizcesi gelir. Örnek çalmadan <b>önce</b>, sessizlikte Türkçesini yüksek sesle söylersin; sonra kendini değerlendirirsin. Hiçbir şey kaydedilmez, mikrofon kullanılmaz.')+'</p>';
  h+=voiceNote();
  h+='<div class="stat"><div><b>'+sd+'</b><span>cümle</span></div>'+
     '<div><b>'+Math.min(kd,SESSION)+'</b><span>kalıp</span></div>'+
     '<div><b>'+rd+'</b><span>anlatım</span></div></div>';

  h+='<h2 class="sec">Çalış</h2>';
  h+='<div class="card"><p class="lead">Cümleler</p><p class="sub">'+tx(sb.length+' sentence'+(sb.length===1?"":"s")+' in range · '+sd+' due today. Up to '+SESSION+' in a sitting.',
     'Kapsamda '+sb.length+' cümle · bugün '+sd+' tane. Bir oturumda en fazla '+SESSION+'.')+'</p>'+
   '<button class="btn" onclick="startProd(\'s\')">Başla</button></div>';
  /* The actionable number is the sitting, not the bank. At fifty prefabs
     "50 due today" was merely odd; at three hundred it reads as a debt
     nobody will clear, when it really means "not started yet, twelve of
     them now" — the same correction the Tekrar hub needed. */
  h+='<div class="card"><p class="lead">Kalıplar</p><p class="sub">'+tx(CHUNKS.length+' conversational prefabs — the ready-made pieces a speaker reaches for before composing anything, grouped by what the phrase does. '+Math.min(kd,SESSION)+' in this sitting, '+kd+' not yet worked through.',
     'Konuşmada hazır kullanılan '+CHUNKS.length+' kalıp; ne işe yaradıklarına göre gruplanmış. Bu oturumda '+Math.min(kd,SESSION)+', henüz çalışılmamış '+kd+'.')+'</p>'+
   '<button class="btn" onclick="startProd(\'k\')">Başla</button></div>';

  h+='<div class="card"><p class="lead">Kurma · build it</p><p class="sub">'+tx('Sentences assembled on the spot from '+LEX.length+' words — you will not have seen them before, so they cannot be recalled, only built.',
     LEX.length+' kelimeden o anda kurulan cümleler. Daha önce görmediğin için ezberden gelmez, kurman gerekir.')+'</p>'+
   '<button class="btn" onclick="startProd(\'g\')">Başla</button></div>';
  h+='<div class="card"><p class="lead">Dönüştürme · change it</p><p class="sub">'+tx('A sentence arrives and one thing about it has to change: negative, past, future, question, person.',
     'Bir cümle gelir ve bir yönünü değiştirirsin: olumsuz, geçmiş, gelecek, soru, kişi.')+'</p>'+
   '<button class="btn" onclick="startProd(\'t\')">Başla</button></div>';

  h+='<h2 class="sec">Üç kez anlat</h2><div class="card">';
  h+='<p class="sub">'+tx('A unit\'s speaking task, told from memory three times: today, in two days, and in a week. Start one from any unit\'s Konuşma card.',
    'Bir ünitenin konuşma görevi, aklından üç kez anlatılır: bugün, iki gün sonra ve bir hafta sonra. Herhangi bir ünitenin Konuşma kartından başlat.')+'</p>';
  if(open.length){
    open.forEach(function(u){
      const r=S.retell[u.id], left=r.d-dayNum();
      h+='<button class="unit" onclick="startRetell(\''+u.id+'\')"><span class="tick '+(left<=0?"here":"")+'">'+r.n+'</span>'+
        '<span class="grow"><span class="unit-t">'+esc(u.tr)+'</span><span class="unit-s">'+esc(u.lv)+' · '+
        (left<=0?"bugün":left+" gün sonra")+' · '+r.n+'/3</span></span><span class="chev">'+IC.chev+'</span></button>';
    });
  }else h+='<p class="tiny">'+tx('Nothing started yet.','Henüz başlanmadı.')+'</p>';
  h+='</div>';

  h+='<h2 class="sec">Ayarlar</h2><div class="card">';
  h+='<p class="lead" style="font-size:.95rem">Sessizlik · the gap</p>'+
   '<p class="sub">'+tx('How long you get before the model plays.','Örnek çalmadan önce ne kadar süren var.')+'</p><div class="segs">';
  GAPS.forEach(function(n){h+='<button class="'+(n===g?"on":"")+'" onclick="setGap('+n+')">'+n+'<i>saniye</i></button>';});
  h+='</div>';
  h+='<p class="lead" style="font-size:.95rem">Kaynak · where sentences come from</p><div class="segs">';
  [["done","Tamamlanan","finished"],["unit","Bu ünite","bookmark"],["all","Tümü","all 60"]].forEach(function(s){
    h+='<button class="'+(pscope()===s[0]?"on":"")+'" onclick="setScope(\''+s[0]+'\')">'+s[1]+'<i>'+s[2]+'</i></button>';
  });
  h+='</div>';
  h+='<button class="btn ghost" onclick="togglePrompt()">'+(S.prompten?"İngilizce sesli ✓":"İngilizceyi de seslendir")+'</button>';
  h+='<p class="tiny" style="margin-top:.5rem">'+tx('The English prompt is read by whatever English voice the device has. Leave it off to read it yourself and keep the silence longer.',
    'İngilizce cümleyi cihazın İngilizce sesi okur. Kendin okumak ve sessizliği uzun tutmak için kapalı bırak.')+'</p>';
  h+='</div>';

  h+='<p class="foot">'+tx('Right answers come back later and later — 1, 2, 4, 8, 16 days — on the same ladder as the word queue. Wrong ones come back today.',
    'Doğrular gittikçe daha geç gelir: 1, 2, 4, 8, 16 gün sonra, kelime sırasıyla aynı merdivende. Yanlışlar bugün yeniden gelir.')+'</p></div>';
  paint(h);
}

function renderProdRun(){
  if(!PR){renderProd();return;}
  if(PR.phase==="end"){
    const banked=PR.mode==="s"||PR.mode==="k";
    const left=banked?prodDue(PR.mode==="k"?chunkBank():sentenceBank()).length:0;
    paint(bar(PR.title,"Bitti",true)+'<div class="wrap"><div class="score">'+
      '<div class="big '+(PR.right*2>=PR.q.length?"pass":"fail")+'">'+PR.right+'/'+PR.q.length+'</div>'+
      '<p class="sub">kendi değerlendirmen · your own marking</p></div>'+
      '<div class="card"><p class="sub">'+(banked?tx(left+' still waiting in this set. The ones you missed come back today.',
                                                    'Bu grupta '+left+' tane daha bekliyor. Yanlış yaptıkların bugün yeniden gelir.')
        :tx('These are built fresh every time, so the set never runs out. What comes back is the pattern you missed.',
            'Bunlar her seferinde yeniden kurulur, yani hiç bitmez. Geri gelen, yanlış yaptığın kalıptır.'))+'</p>'+
      '<button class="btn" onclick="startProd(\''+PR.mode+'\')">Devam</button>'+
      '<button class="btn ghost" onclick="go(\'prod\')">Üretim</button></div></div>');
    return;
  }
  const it=PR.q[PR.i];
  let h=bar(PR.title,(PR.i+1)+" / "+PR.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+PR.q.map(function(_,i){return '<i class="'+(i<PR.i?"ok":"")+'"></i>';}).join('')+'</div>';
  h+='<p class="qn">'+(PR.phase==="build"?"Sondan başa · backward buildup":"Söyle · say it")+'</p>';
  h+='<div class="card" style="text-align:center;padding:1.8rem 1rem">';
  if(it.given){
    h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.35rem;margin:0 0 .5rem">'+esc(it.given)+'</p>'+
     '<p class="pill cob" style="display:inline-block">'+esc(it.instr)+'</p>';
  }else h+='<p class="sub" style="font-size:1.05rem;margin:0">'+esc(it.en)+'</p>';
  if(PR.phase==="gap"){
    h+='<p class="mark" id="pcount" style="font-size:3rem;margin:.8rem 0 .1rem;color:var(--turk)">'+PR.left+'</p>'+
     '<p class="tiny">Şimdi yüksek sesle söyle · say it out loud now</p>';
  }else if(PR.phase==="model"){
    h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.6rem;line-height:1.35;margin:.8rem 0 0">'+esc(it.tr)+'</p>'+
     '<button class="sbtn" style="margin-top:.6rem" onclick="prodSay()">'+IC.spk+' tekrar</button>';
  }else{
    h+='<p style="font-family:\'Crimson Pro\',serif;font-size:1.5rem;line-height:1.35;margin:.8rem 0 0">'+esc(PR.build[PR.bi])+'</p>'+
     '<p class="tiny" style="margin-top:.5rem">'+(PR.bi+1)+' / '+PR.build.length+' · '+tx('repeat this piece, then take the next','bu parçayı tekrar et, sonra sıradakine geç')+'</p>';
  }
  h+='</div>';
  h+='<p class="tiny" style="text-align:center">'+esc(it.lv+" · "+it.from)+'</p>';
  if(PR.phase==="gap")h+='<button class="btn ghost" onclick="prodModel()">Şimdi göster</button>';
  else if(PR.phase==="model"){
    h+='<div class="btn-row"><button class="btn ghost" onclick="prodMark(false)">Yanlış</button>'+
     '<button class="btn" onclick="prodMark(true)">Doğru</button></div>';
    if(clauseSplit(it.tr).length>1)h+='<button class="btn ghost" onclick="prodBuild()">Sondan başa kur</button>';
  }else h+='<button class="btn" onclick="prodBuildNext()">'+(PR.bi+1>=PR.build.length?"Bitir":"Sonraki parça")+'</button>';
  h+='</div>';
  paint(h);
}

function renderRetell(){
  const u=unit(V.u), r=(S.retell&&S.retell[u.id])||{n:0,d:dayNum()};
  const all=r.n>=3, now=r.d<=dayNum(), left=Math.max(0,r.d-dayNum());
  let h=bar("Anlat",u.lv+" · "+u.tr,true)+'<div class="wrap">';
  h+='<div class="card"><p class="tiny">Konuşma görevi · the speaking task</p>'+
   '<p class="lead" style="margin-top:.2rem">'+esc(u.speak)+'</p></div>';
  h+='<div class="stat"><div><b>'+r.n+'/3</b><span>anlatıldı</span></div>'+
   '<div><b>'+(all?"✓":(now?"bugün":left+" gün"))+'</b><span>'+(all?"tamam":"sıradaki")+'</span></div></div>';
  h+='<div class="card"><p class="sub">'+tx('Say the whole thing out loud, from memory, without reading the passage. These are the ten words the unit gave you.',
    'Metne bakmadan, aklından, hepsini yüksek sesle anlat. Ünitenin sana verdiği on kelime şunlar.')+'</p>'+
   '<div class="pillrow">';
  u.vocab.forEach(function(w){h+='<span class="pill">'+esc(w[0])+'</span>';});
  h+='</div></div>';
  if(all)h+='<div class="card"><p class="lead">Üç kez anlatıldı ✓</p>'+
   '<p class="sub">'+tx('Told on day one, day three and day seven. Start it again whenever you like.','Birinci, üçüncü ve yedinci gün anlatıldı. İstediğin zaman yeniden başlayabilirsin.')+'</p>'+
   '<button class="btn ghost" onclick="retellReset(\''+u.id+'\')">Baştan</button></div>';
  else if(now)h+='<button class="btn" onclick="retellDone(\''+u.id+'\')">Anlattım</button>';
  else h+='<div class="card"><p class="sub">'+tx('Not due yet — it comes back on its own in '+left+' day'+(left===1?"":"s")+'. Telling it again today is not what makes it stick.',
    'Henüz sırası gelmedi; '+left+' gün sonra kendiliğinden gelecek. Akılda kalmasını sağlayan bugün yeniden anlatmak değil.')+'</p>'+
   '<button class="btn ghost" onclick="retellDone(\''+u.id+'\')">Yine de anlattım</button></div>';
  h+='<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'r\')">Üniteye dön</button></div>';
  paint(h);
}

