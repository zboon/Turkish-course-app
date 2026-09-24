/* Türkçe Macera — the games. A lesson is a list of rounds; each round is
   one small game over the unit's own words and phrases.

   The mix leans on recall rather than recognition, as the course does:
   tap-to-choose where it genuinely teaches (hearing the difference
   between words, a first meeting), and building or typing the word
   wherever the child can manage it. In a lesson a round answered wrong
   comes back at the end until it is right, and only the first try is
   scored; in the trophy challenge nothing comes back, because it is a
   test. */

/* ===================== macera · games ===================== */
let G=null;
const PRAISE=[["Harika!","great"],["Aferin!","well done"],["Süper!","super"],["Çok iyi!","very good"],["Bravo!","bravo"]];
const LESSONS=[["Tanış","meet the words","👀"],["Oyna","play with them","🧩"],["Konuş","talk","💬"]];
const CUP_N=10, CUP_PASS=8;
const RETRY_MAX=2;

function optsFor(w,pool,n){
  const others=shuffle(pool.filter(function(x){return x.k!==w.k&&x.em!==w.em;})).slice(0,n-1);
  return shuffle(others.concat([w]));
}
/* A word spelt with tiles: one written word, short enough to build. */
function spellable(w){return /^[a-zçğıöşüâîû]+$/.test(w.tr)&&w.tr.length<=10;}
let RID=0;
function R(o){o.rid=++RID;return o;}
function rLearn(w){return R({t:"learn",w:w});}
function rTalk(u){return R({t:"talk",u:u.id});}
function rHear(w,pool){return R({t:"hear",w:w,opts:optsFor(w,pool,4)});}
function rSee(w,pool){return R({t:"see",w:w,opts:optsFor(w,pool,4)});}
function rMatch(ws){return R({t:"match",ws:ws,left:shuffle(ws),right:shuffle(ws)});}
function rSpell(w){return R({t:"spell",w:w,tiles:spellTiles(w.tr)});}
function rType(w){return R({t:"type",w:w});}
function rOrder(p){
  let tiles=shuffle(p[0].split(" "));
  if(tiles.length>1&&tiles.join(" ")===p[0])tiles=tiles.slice(1).concat(tiles[0]);
  return R({t:"order",p:{tr:p[0],en:p[1]},tiles:tiles});
}
function multiWord(p){return String(p[0]).trim().split(/\s+/).length>=2;}
function rSay(p){return R({t:"say",p:{tr:p[0],en:p[1]}});}
const UNSCORED={learn:1,talk:1};

function buildLesson(u,n){
  const W=wordsOf(u), sh=shuffle(W);
  if(n===0)return W.map(rLearn).concat(shuffle(sh.slice(0,5).map(function(w){return rHear(w,W);})
                              .concat(sh.slice(5).map(function(w){return rSee(w,W);}))));
  if(n===1){
    const sp=shuffle(W.filter(spellable)).slice(0,4);
    return [rMatch(sh.slice(0,5)),rMatch(sh.slice(5,10))]
      .concat(shuffle(sp.map(rSpell).concat(shuffle(W).slice(0,2).map(function(w){return rHear(w,W);}))));
  }
  /* Two phrases are built from tiles, which needs two words or more; the
     other two are said aloud, which works for any. */
  const ps=shuffle(u.phrases), multi=ps.filter(multiWord).slice(0,2);
  const said=ps.filter(function(p){return multi.indexOf(p)<0;}).slice(0,2);
  return [rTalk(u)].concat(shuffle(multi.map(rOrder).concat(said.map(rSay))
                                   .concat(shuffle(W).slice(0,3).map(rType))));
}
/* The trophy: ten, first try only, typing and spelling as well as hearing
   and building, so passing it means knowing the unit rather than having
   tapped through it. It is also the way to test out of a unit. */
function buildCup(u){
  const W=shuffle(wordsOf(u)), ps=shuffle(u.phrases.filter(multiWord));
  const typed=W.slice(0,4), rest=W.slice(4);
  const sp=rest.filter(spellable).slice(0,2);
  const heard=rest.filter(function(w){return sp.indexOf(w)<0;}).slice(0,2);
  const q=typed.map(rType).concat(sp.map(rSpell),heard.map(function(w){return rHear(w,wordsOf(u));}),ps.slice(0,2).map(rOrder));
  /* Always CUP_N: a unit short of spellable words tops up with hearing. */
  rest.forEach(function(w){if(q.length<CUP_N&&sp.indexOf(w)<0&&heard.indexOf(w)<0)q.push(rHear(w,wordsOf(u)));});
  return shuffle(q.slice(0,CUP_N));
}
function buildReview(){
  return reviewDue().slice(0,KREVIEW).map(function(w){
    const pool=wordsOf(kunit(w.u));
    const kinds=["hear","see","type"]; if(spellable(w))kinds.push("spell");
    const t=kinds[Math.floor(Math.random()*kinds.length)];
    return t==="hear"?rHear(w,pool):t==="see"?rSee(w,pool):t==="spell"?rSpell(w):rType(w);
  });
}

/* --- a run ----------------------------------------------------------- */
function newRun(kind,u,n,q){
  G={kind:kind,u:u,n:n,q:q,i:0,phase:"ask",scored:0,first:0,xp:0,tries:{},wres:{},
     ok:null,praise:null,built:[],typed:"",heard:{},m:null,tid:null,line:-1,done:false,res:null};
  V={view:"play"};window.scrollTo(0,0);touchDay();render();
}
function startLesson(id,n){
  const u=kunit(id); if(!u||!lessonOpen(id,n))return;
  stopPlay(); newRun("lesson",id,n,buildLesson(u,n));
}
function startCup(id){
  const u=kunit(id); if(!u||!unitOpen(id))return;
  stopPlay(); newRun("cup",id,3,buildCup(u));
}
function startReview(){
  const q=buildReview(); if(!q.length){home();return;}
  stopPlay(); newRun("review",null,null,q);
}
/* The token strands any read-aloud still in flight: a watchdog that fires
   after the round has moved on must not start reading over the next one. */
let TTOK=0;
function gameStop(){TTOK++;if(G&&G.tid){clearTimeout(G.tid);G.tid=null;}if(G)G.line=-1;}
function cur(){return G&&G.q[G.i];}

/* Mark the current round. Only a round's first try is scored; a lesson
   sends a missed round round again at the end, the trophy does not. */
function judge(ok){
  const r=cur(); if(!r)return;
  const n=(G.tries[r.rid]=(G.tries[r.rid]||0)+1);
  if(n===1){
    G.scored++;
    if(ok){G.first++;G.xp+=10;S.xp+=10;}
    if(r.w&&(r.t==="hear"||r.t==="see"||r.t==="type"||r.t==="spell"))G.wres[r.w.k]=ok;
    if(G.kind==="review"&&r.w)bump(S.srs,r.w.k,function(b){return ok?b+1:0;});
  }else if(ok){G.xp+=5;S.xp+=5;}
  if(!ok&&G.kind!=="cup"&&r.t!=="match"&&n<=RETRY_MAX){
    const again=Object.assign({},r,{retry:true});
    if(again.opts)again.opts=shuffle(again.opts);
    if(again.tiles)again.tiles=shuffle(again.tiles);
    G.q.push(again);
  }
  G.ok=ok; G.praise=PRAISE[Math.floor(Math.random()*PRAISE.length)];
  G.phase="fb"; chime(ok); save(); render();
  /* The word is heard again after every answer, right or wrong. */
  const said=r.w?r.w.tr:r.p?r.p.tr:null;
  if(said&&r.t!=="hear")say(said,0.85);
}
function next(){
  if(!G)return;
  gameStop();
  G.i++;G.phase="ask";G.ok=null;G.built=[];G.typed="";G.m=null;
  window.scrollTo(0,0);
  if(G.i>=G.q.length){finish();return;}
  render();
}
function finish(){
  const acc=G.scored?G.first/G.scored:1;
  const stars=acc>=0.9?3:acc>=0.7?2:1;
  const res={stars:stars,acc:acc,pass:false,opened:null};
  if(G.kind==="lesson"){
    const p=prog(G.u); p.l[G.n]=Math.max(p.l[G.n]||0,stars); setProg(G.u,p);
    /* The first lesson seeds the review: a word got right first time
       comes back tomorrow, a word missed comes back today. */
    if(G.n===0)Object.keys(G.wres).forEach(function(k){if(!S.srs[k])bump(S.srs,k,function(){return G.wres[k]?1:0;});});
  }else if(G.kind==="cup"){
    res.pass=G.first>=CUP_PASS;
    if(res.pass){
      const was=cupWon(G.u), p=prog(G.u);
      p.cup={at:Date.now(),score:G.first}; setProg(G.u,p);
      const nx=KUNITS[kidx(G.u)+1];
      if(!was&&nx)res.opened=nx;
    }
  }
  G.res=res; G.done=true; save(); render();
}
/* --- answers --------------------------------------------------------- */
function pick(k){const r=cur(); if(!r||G.phase!=="ask")return; G.sel=k; judge(k===r.w.k);}
function mTapL(k){
  const r=cur(); if(!r||G.phase!=="ask")return;
  if(!G.m)G.m={sel:null,done:{},miss:0,bad:null};
  if(G.m.done[k])return;
  G.m.sel=k; G.m.bad=null;
  const w=r.ws.find(function(x){return x.k===k;}); say(w.tr,0.85);
  render();
}
function mTapR(k){
  const r=cur(); if(!r||G.phase!=="ask")return;
  if(!G.m)G.m={sel:null,done:{},miss:0,bad:null};
  if(G.m.done[k]||!G.m.sel)return;
  if(G.m.sel===k){G.m.done[k]=1;G.m.sel=null;G.m.bad=null;chime(true);}
  else{G.m.miss++;G.m.bad=k;chime(false);}
  if(Object.keys(G.m.done).length===r.ws.length){judge(G.m.miss===0);return;}
  render();
}
function tAdd(i){const r=cur(); if(!r||G.phase!=="ask"||G.built.indexOf(i)>-1)return; G.built.push(i); render();}
function tDel(j){if(!G||G.phase!=="ask")return; G.built.splice(j,1); render();}
function spellCheck(){
  const r=cur(); if(!r||!G.built.length)return;
  judge(G.built.map(function(i){return r.tiles[i];}).join("")===r.w.tr);
}
function orderCheck(){
  const r=cur(); if(!r||!G.built.length)return;
  judge(fold(G.built.map(function(i){return r.tiles[i];}).join(" "))===fold(r.p.tr));
}
function typeCheck(){
  const r=cur(); const box=document.getElementById("kbox"); if(!r||!box)return;
  G.typed=box.value;
  judge(fold(G.typed)===fold(r.w.tr)&&fold(G.typed)!=="");
}
function sayShow(){const r=cur(); if(!r)return; G.phase="reveal"; render(); say(r.p.tr,0.85);}
function saySelf(ok){if(G&&G.phase==="reveal"){G.phase="ask";judge(ok);}}
/* The comic reads itself aloud, line after line; each line can be tapped. */
function talkPlay(from){
  const r=cur(); if(!r||r.t!=="talk")return;
  const lines=kunit(r.u).talk;
  gameStop();
  const tok=TTOK;
  const step=function(i){
    if(tok!==TTOK)return;
    if(!G||G.phase!=="ask"||i>=lines.length){if(G){G.line=-1;render();}return;}
    G.line=i; render();
    let done=false;
    const go=function(){if(done||tok!==TTOK)return;done=true;if(G)G.tid=setTimeout(function(){step(i+1);},600);};
    say(lines[i][1],0.85,go);
    G.tid=setTimeout(go,1500+lines[i][1].length*90);
  };
  step(from||0);
}
function talkLine(i){const r=cur(); if(!r||r.t!=="talk")return; gameStop(); G.line=i; render(); say(kunit(r.u).talk[i][1],0.85);}
