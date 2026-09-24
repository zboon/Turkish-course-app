/* Çöz: take a word apart, and read it by its pieces. */

/* ===================== çöz · the decoder ===================== */
/* A polyglot's first move with Turkish is not a word list, it is the
   suffix chain: learn what -lAr, -(I)m, -DA and -(y)Abil do and a word
   never seen before reads itself. Everything else in this app builds
   words (Kurma, Dönüştürme, Tekrar) or hears them; nothing asked the
   learner to take one apart.

   So a generated word arrives, is said, and four meanings are offered.
   Each wrong one is the right one with ONE piece changed (another
   person, another tense, the negative, another case), so a word cannot
   be answered by recognising its stem, only by reading its endings. The
   answer then comes back in pieces: surface, label, meaning, and a line
   for every letter that is not simply the label with its vowels filled
   in (a softened stem, a buffer, a d that became t).

   Like the other generated modes it is scheduled by pattern, not by
   word: S.coz is keyed by the suffix a question was about ("fut",
   "loc"), because the words are endless and the pieces are fourteen.
   And like everything else it asks only for what has been met: each
   piece opens with the unit whose grammar teaches it. */
const CZ_SESSION=10, CZ_NEW=3;
const CZ_ROLES=[
 {k:"pl",  kind:"n",u:"a1u2",a:"-lAr",en:"plural"},
 {k:"ps",  kind:"n",u:"a1u3",a:"-(I)m, -(s)I …",en:"my, his …"},
 {k:"loc", kind:"n",u:"a1u4",a:"-DA",en:"in, at, on"},
 {k:"prog",kind:"v",u:"a1u5",a:"-(I)yor",en:"now, -ing"},
 {k:"abl", kind:"n",u:"a1u8",a:"-DAn",en:"from"},
 {k:"past",kind:"v",u:"a2u1",a:"-DI",en:"past"},
 {k:"fut", kind:"v",u:"a2u2",a:"-(y)AcAk",en:"will"},
 {k:"dat", kind:"n",u:"a2u3",a:"-(y)A",en:"to"},
 {k:"abil",kind:"v",u:"a2u4",a:"-(y)Abil",en:"can"},
 {k:"aor", kind:"v",u:"a2u6",a:"-Ir / -Ar",en:"as a rule"},
 {k:"ile", kind:"n",u:"a2u8",a:"-(y)lA",en:"with"},
 {k:"mis", kind:"v",u:"b1u1",a:"-mIş",en:"apparently"},
 {k:"sa",  kind:"v",u:"b1u2",a:"-sA",en:"if"},
 {k:"mali",kind:"v",u:"b2u2",a:"-mAlI",en:"must"}];
const CZ_CASES=["loc","abl","dat","ile"];
function czRole(k){return CZ_ROLES.find(function(r){return r.k===k;});}
function czIsOpen(k){const r=czRole(k);return !!r&&metGram(r.u);}
/* What can be asked. A noun piece alone has nothing to be confused with
   (kitaplar: books, or book), so nouns wait for a second noun piece;
   one verb piece already has six persons and a negative. */
function czRoles(){
  const open=CZ_ROLES.filter(function(r){return metGram(r.u);});
  const nn=open.filter(function(r){return r.kind==="n";}).length;
  return open.filter(function(r){return r.kind==="v"||nn>=2;});
}
function czVerbs(){return drillable().filter(function(e){return !e.stative;});}

/* --- a question -------------------------------------------------------- */
function czBuild(s){
  if(s.k==="v"){const r=czVerb(s.v,s.t,s.p,s.neg); if(r)r.en=czVerbEN(s.v,s.t,s.p,s.neg); return r;}
  const n=czNoun(s.n,s.pl,s.ps,s.c); if(n)n.en=czNounEN(s.n,s.pl,s.ps,s.c); return n;
}
function czSpec(r){
  if(r.kind==="v")return {k:"v",v:pick(czVerbs()),t:r.k,p:Math.floor(Math.random()*6),neg:Math.random()<0.3};
  const cs=CZ_CASES.filter(czIsOpen);
  const pool=CZ_CASES.indexOf(r.k)>-1?CZ_NOUNS.filter(function(n){return n.c[r.k];}):CZ_NOUNS;
  const n=pick(pool);
  const pl=r.k==="pl"||(czIsOpen("pl")&&Math.random()<0.3);
  let ps=r.k==="ps"||(czIsOpen("ps")&&Math.random()<0.4)?Math.floor(Math.random()*5):null;
  if(pl&&ps===2)ps=pick([0,1,3,4]);
  let c=CZ_CASES.indexOf(r.k)>-1?r.k:null;
  if(!c){const can=cs.filter(function(k){return n.c[k];}); if(can.length&&Math.random()<0.4)c=pick(can);}
  return {k:"n",n:n,pl:pl,ps:ps,c:c};
}
/* Every spec one piece away, within what is open. The first list holds
   the changes to the piece the question is about, so at least one wrong
   answer always differs exactly there. */
function czNear(s,role){
  const out=[[],[]];
  const put=function(focus,x){out[focus?0:1].push(Object.assign({},s,x));};
  if(s.k==="v"){
    for(let p=0;p<6;p++)if(p!==s.p)put(false,{p:p});
    CZ_ROLES.forEach(function(r){if(r.kind==="v"&&r.k!==s.t&&czIsOpen(r.k))put(true,{t:r.k});});
    put(role==="prog"||role==="past"||role==="fut",{neg:!s.neg});
  }else{
    const n=s.n;
    if(czIsOpen("pl")&&!(s.ps===2&&!s.pl))put(role==="pl",{pl:!s.pl});
    if(czIsOpen("ps"))[null,0,1,2,3,4].forEach(function(ps){
      if(ps!==s.ps&&!(s.pl&&ps===2))put(role==="ps",{ps:ps});});
    [null].concat(CZ_CASES).forEach(function(c){
      if(c!==s.c&&(c===null||(czIsOpen(c)&&n.c[c])))put(c===role||s.c===role,{c:c});});
  }
  return out;
}
function czShuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
/* Other readings of the same letters, from the whole of this noun's
   space: evinde is "in your house" and "in his/her house" both. The
   options never offer the second, and the note says it exists. */
function czAlso(s,ans){
  if(s.k!=="n")return [];
  const seen={}, out=[];
  [false,true].forEach(function(pl){[null,0,1,2,3,4].forEach(function(ps){[null].concat(CZ_CASES).forEach(function(c){
    if(pl&&ps===2)return;
    if(c&&!s.n.c[c])return;
    const r=czNoun(s.n,pl,ps,c); if(!r||r.w!==ans.w)return;
    const en=czNounEN(s.n,pl,ps,c);
    if(en!==ans.en&&!seen[en]){seen[en]=1;out.push(en);}
  });});});
  return out;
}
function czItem(role){
  const r=czRole(role);
  for(let tries=0;tries<40;tries++){
    const s=czSpec(r), ans=czBuild(s);
    if(!ans)continue;
    const also=czAlso(s,ans);
    const near=czNear(s,role), cand=czShuffle(near[0]).slice(0,2).concat(czShuffle(near[1].concat(near[0].slice(2))));
    const opts=[{en:ans.en,w:ans.w}], ws={}, ens={};
    /* The other readings share the answer's spelling, so the spelling
       check below is what keeps them off the list. */
    ws[ans.w]=1; ens[ans.en]=1;
    for(let i=0;i<cand.length&&opts.length<4;i++){
      const o=czBuild(cand[i]);
      if(!o||ws[o.w]||ens[o.en])continue;
      ws[o.w]=1; ens[o.en]=1; opts.push({en:o.en,w:o.w});
    }
    if(opts.length<4)continue;
    const order=czShuffle([0,1,2,3]);
    return {role:role,w:ans.w,en:ans.en,pieces:ans.pieces,also:also,
            notes:ans.notes.concat(also.map(function(e){return ans.w+" also says \""+e+"\": the letters are the same, and the sentence decides.";})),
            opts:order.map(function(i){return opts[i];}),c:order.indexOf(0)};
  }
  return null;
}

/* --- the sitting -------------------------------------------------------- */
/* Suffixes due come first, each twice, and up to CZ_NEW never practised
   a day; the rest of the ten is practice drawn from everything open,
   which is marked right or wrong but moves no schedule. */
let CZ=null;
function czDue(){
  const roles=czRoles();
  return dueItems(S.coz||{},roles.map(function(r){return {k:r.k};}),CZ_NEW).map(function(x){return x.k;});
}
function startCoz(){
  stopPlay();
  const roles=czRoles().map(function(r){return r.k;});
  if(!roles.length){go("coz");return;}
  const due=czDue(), seq=[];
  due.forEach(function(k){if(seq.length<CZ_SESSION)seq.push(k);});
  due.forEach(function(k){if(seq.length<CZ_SESSION)seq.push(k);});
  while(seq.length<CZ_SESSION)seq.push(pick(roles));
  const q=[];
  czShuffle(seq).forEach(function(k){const it=czItem(k); if(it)q.push(it);});
  if(!q.length){go("coz");return;}
  CZ={q:q,i:0,sel:null,right:0,due:due,miss:{},heard:{}};
  V={view:"cozrun"};window.scrollTo(0,0);
  touchDay();render();
}
function czWhy(it){
  return it.pieces.filter(function(p){return p.m;}).map(function(p){return p.m;}).join("-")+": "+
    it.pieces.map(function(p){return p.en;}).join(" · ");
}
function czPick(i){
  if(!CZ||CZ.sel!==null)return;
  const it=CZ.q[CZ.i]; CZ.sel=i;
  if(i===it.c)CZ.right++;
  else{
    CZ.miss[it.role]=1;
    errNote("coz:"+it.role,{m:"o",q:it.en,c:it.w,a:it.opts[i].en,w:czWhy(it),to:czRole(it.role).u});
  }
  render();
}
function czSay(){const it=CZ&&CZ.q[CZ.i];if(it)say(it.w);}
function czSayOpt(i){const it=CZ&&CZ.q[CZ.i];if(it&&it.opts[i])say(it.opts[i].w);}
/* The schedule moves once, at the end, one step per suffix: a suffix
   missed anywhere in the sitting comes back today. Leaving early writes
   nothing, as in Yolda. */
function czNext(){
  if(!CZ)return;
  CZ.i++; CZ.sel=null; window.scrollTo(0,0);
  if(CZ.i>=CZ.q.length){
    if(!S.coz)S.coz={};
    CZ.due.forEach(function(k){bump(S.coz,k,function(b){return CZ.miss[k]?0:b+1;});});
    save();
  }
  render();
}

/* --- screens ------------------------------------------------------------ */
function czChips(pieces){
  return '<div class="cz">'+pieces.map(function(p){
    return '<span class="czp '+p.r+'"><b>'+(p.m?esc(p.m):'·')+'</b><i>'+esc(p.a)+'</i><span>'+esc(p.en)+'</span></span>';
  }).join('<span class="czplus">+</span>')+'</div>';
}
/* A fixed worked word for the hub, from the first piece open, so the
   page shows what a breakdown looks like before a sitting starts. */
function czExample(){
  const open=czRoles();
  const v=open.find(function(r){return r.kind==="v";});
  if(v)return czVerb(byName("gelmek"),v.k,0,false);
  const n=CZ_NOUNS[0], c=CZ_CASES.find(czIsOpen)||null;
  return czNoun(n,czIsOpen("pl"),czIsOpen("ps")?0:null,c);
}
function renderCoz(){
  const roles=czRoles(), due=roles.length?czDue():[];
  const firm=roles.filter(function(r){const x=S.coz&&S.coz[r.k];return x&&x.b>=4;}).length;
  let h=bar("Çöz","take a word apart",true,"kelimeyi parçalarına ayır")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('A Turkish word is a stem and a queue of endings, each doing one job in a fixed order: <i>gel-ebil-ir-im</i> is come · can · as a rule · I. Read the endings and a word you have never seen reads itself. A word is said and four meanings are offered; each wrong one differs from the right one by a single piece.',
    'Türkçe bir kelime bir kök ve arka arkaya gelen eklerdir; her ek bir iş görür ve sıraları bellidir: <i>gel-ebil-ir-im</i>. Ekleri okursan hiç görmediğin bir kelime kendini okur. Bir kelime söylenir, dört anlam gelir; yanlışların her biri doğrusundan tek bir ekle ayrılır.')+'</p>';
  if(!roles.length){
    h+='<div class="card"><p class="lead">Şimdilik boş<span class="gl">empty for now</span></p><p class="sub">'+
     tx('It opens with the grammar that teaches the endings: the present tense in A1 unit 5, or the plural and the possessive together in units 2 and 3. Each ending joins as its unit’s grammar is read.',
        'Ekleri öğreten dilbilgisiyle açılır: A1’in 5. ünitesindeki şimdiki zamanla, ya da 2. ve 3. ünitelerdeki çoğul ve iyelik ekleriyle. Her ek, ünitesinin dilbilgisi okununca katılır.')+'</p></div>';
  }else{
    h+='<div class="stat"><div><b>'+roles.length+'</b><span>'+tx('endings open','açık ek')+'</span></div>'+
       '<div><b>'+due.length+'</b><span>'+tx('due','sırada')+'</span></div>'+
       '<div><b>'+firm+'</b><span>'+tx('holding','oturmuş')+'</span></div></div>';
    h+='<button class="btn" onclick="startCoz()">Başla</button>';
    if(!due.length)h+='<p class="tiny" style="text-align:center">'+tx('Nothing due: a sitting now is practice and moves no schedule.','Sırada bir şey yok: şimdi yapılan oturum alıştırmadır, sırayı değiştirmez.')+'</p>';
    const ex=czExample();
    if(ex){
      h+='<h2 class="sec">Örnek</h2><div class="card"><p class="czw">'+esc(ex.w)+'</p>'+czChips(ex.pieces)+
       '<p class="tiny" style="margin-top:.6rem">'+tx('Above each piece what is written, under it the label a grammar uses (A and I stand for the vowel harmony chooses) and what it means.',
         'Her parçanın üstünde yazılan, altında dilbilgisinin kullandığı ad (A ve I, ünlü uyumunun seçeceği ünlünün yerini tutar) ve anlamı.')+'</p></div>';
    }
  }
  h+='<h2 class="sec">Ekler</h2><div class="card">';
  CZ_ROLES.forEach(function(r){
    const on=metGram(r.u), u=unit(r.u);
    h+='<div class="row czrow'+(on?'':' off')+'"><b class="grow">'+esc(r.a)+' <span class="tiny">'+esc(r.en)+'</span></b>'+
      '<span class="tiny">'+(on?'✓ ':'')+esc(u.lv+' · '+u.tr)+'</span></div>';
  });
  h+='</div><p class="foot">'+tx('Each ending opens with the unit that teaches it. Scheduled by ending, not by word: the words are endless, the endings are fourteen.',
    'Her ek, onu öğreten üniteyle açılır. Kelimeye göre değil eke göre sıraya konur: kelimeler sonsuz, ekler on dört.')+'</p></div>';
  paint(h);
}
function renderCozRun(){
  if(!CZ){renderCoz();return;}
  if(CZ.i>=CZ.q.length){
    endScreen({title:"Çöz",n:CZ.right,of:CZ.q.length,label:"doğru okundu · read right",
      again:"startCoz()",hub:"go('coz')",hubName:"Çöz"});
    return;
  }
  const it=CZ.q[CZ.i], done=CZ.sel!==null;
  let h=bar("Çöz",(CZ.i+1)+" / "+CZ.q.length,true)+'<div class="wrap">';
  h+='<div class="prog">'+CZ.q.map(function(_,i){return '<i class="'+(i<CZ.i?"ok":"")+'"></i>';}).join('')+'</div>';
  h+='<p class="qn">Ne demek? · what does it mean?</p>';
  h+='<p class="czw">'+esc(it.w)+' <button class="sbtn" onclick="czSay()">'+IC.spk+'</button></p>';
  it.opts.forEach(function(o,i){
    let cls="opt";
    if(done){if(i===it.c)cls+=" right";else if(i===CZ.sel)cls+=" wrong";else cls+=" dim";}
    h+='<button class="'+cls+'" '+(done?'':'onclick="czPick('+i+')"')+'>'+esc(o.en)+'</button>';
  });
  if(done){
    const ok=CZ.sel===it.c, ch=it.opts[CZ.sel];
    h+='<div class="fb '+(ok?"ok":"no")+'"><b>'+(ok?"Doğru":"Yanlış")+'</b>'+
      (ok?tx('Read by its pieces:','Parçalarıyla:')
         :tx('“'+esc(ch.en)+'” would be <span class="czf">'+esc(ch.w)+'</span>.','Seçtiğin anlam <span class="czf">'+esc(ch.w)+'</span> olurdu.')+
          ' <button class="sbtn" onclick="czSayOpt('+CZ.sel+')">'+IC.spk+'</button>')+'</div>';
    h+='<div class="card">'+czChips(it.pieces);
    if(it.notes.length)h+='<ul class="cznotes">'+it.notes.map(function(n){return '<li>'+esc(n)+'</li>';}).join('')+'</ul>';
    h+='</div><button class="btn" onclick="czNext()">'+(CZ.i+1>=CZ.q.length?"Sonuç":"Devam")+'</button>';
  }
  h+='</div>';
  paint(h);
  if(!done&&!CZ.heard[CZ.i]){CZ.heard[CZ.i]=1;say(it.w);}
}
