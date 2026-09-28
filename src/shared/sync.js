/* ===================== shared · sync ===================== */
/* Progress across devices. Each app keeps its progress in one object, S,
   saved to this browser's localStorage; that stays the truth on the
   device, and the app works with no network at all. When the page runs
   as a claude.ai artifact, the viewer's own Claude account is the login:
   the `db` capability gives every signed-in person a private subtree,
   data/users/<id>/, that nobody else can read, the artifact's owner
   included. This file copies S there and merges it back, so the same
   account on a phone and a laptop sees the same progress.

   MERGING, NOT OVERWRITING
   One person on two devices rarely works on both at once, but it happens
   (a sitting on the train with no signal, another at home), and a plain
   "newest save wins" would throw one of them away. So every key of S
   is merged at the grain its data has:
   - a map (srs, done, err …) entry by entry: each entry carries the time
     it last changed, and the later one wins. A deleted entry keeps its
     time as a tombstone, so a deletion travels too.
   - a set (the starred words, the days studied) element by element, the
     same way.
   - anything else (a setting, the placement bookmark) whole, the later
     one winning.
   The times are not stored in S. This layer keeps its own record next
   to it (the base: S as last synced, and the stamps), and on each sync
   compares S with the base to find what changed and stamp it. So the
   apps change nothing about how they write S: a save is a save.

   The first sync from a device merges with what the account already
   holds rather than replacing it: an entry only this device has is kept,
   and where both have one the account's wins, since this device's copy
   was never stamped. Keys listed as local (the colour theme, the speech
   rate, which depend on the device) are never synced.

   THE STORE
   Each key is written as one document, or as up to eight buckets for a
   large map, each split into chunks well under the 256 KiB a document
   may hold. A chunk carries a hash of its bucket, so a bucket whose
   write was interrupted halfway is recognised and skipped rather than
   read as half its entries. Only the buckets that changed are written.

   It runs only where the platform answers: claude.use("db") and a user
   id. Anywhere else (GitHub Pages, a saved copy, the tests) SYNC.st stays
   "off" and nothing here does anything. */
const SYNC_CHUNK=50000, SYNC_BIG=90000, SYNC_BUCKETS=8, SYNC_WAIT=8000;
let SYNC={st:"off",at:0,msg:""};

function syncHash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(36);}
function syncJson(v){return v===undefined?"":JSON.stringify(v);}
/* A key's mode: "map" (an object of entries), "set" (an array whose
   elements have an identity) or "whole". */
function syncMode(o,k){return o.maps.indexOf(k)>-1?"map":Object.prototype.hasOwnProperty.call(o.sets,k)?"set":"whole";}
function syncSetId(o,k,x){const f=o.sets[k];return f?f(x):typeof x==="string"?x:JSON.stringify(x);}
/* The entries of a map or set value, keyed by entry id. */
function syncSubs(o,k,mode,v){
  const out={};
  if(mode==="map"){if(v&&typeof v==="object"&&!Array.isArray(v))Object.keys(v).forEach(function(s){out[s]=v[s];});}
  else if(Array.isArray(v))v.forEach(function(x){out[syncSetId(o,k,x)]=x;});
  return out;
}
/* And back. A set keeps the order of the list it is given. */
function syncBuild(mode,subs,order){
  if(mode==="map"){const v={};order.forEach(function(s){if(Object.prototype.hasOwnProperty.call(subs,s))v[s]=subs[s];});return v;}
  return order.filter(function(s){return Object.prototype.hasOwnProperty.call(subs,s);}).map(function(s){return subs[s];});
}
function syncKeys(o,cur,base){
  const ks={};
  Object.keys(cur||{}).concat(Object.keys(base||{})).forEach(function(k){
    if(o.local.indexOf(k)<0&&/^[A-Za-z0-9_]+$/.test(k))ks[k]=1;
  });
  return Object.keys(ks);
}
function syncBucket(s,n){return n>1?parseInt(syncHash(s),36)%n:0;}

/* --- the pure part: stamp, merge, write out, read back ------------------ */
/* Compare S with the base and stamp what changed at `now`. meta is
   {base:{k: json or {s: json}}, m:{k: t or {s: t}}}. */
function syncStamp(o,meta,cur,now){
  syncKeys(o,cur,meta.base).forEach(function(k){
    const mode=syncMode(o,k), v=cur[k];
    if(mode==="whole"){
      const j=syncJson(v);
      if(j!==meta.base[k]){meta.base[k]=j;meta.m[k]=now;}
      return;
    }
    const subs=syncSubs(o,k,mode,v), b=meta.base[k]&&typeof meta.base[k]==="object"?meta.base[k]:{}, nb={};
    const m=meta.m[k]&&typeof meta.m[k]==="object"?meta.m[k]:(meta.m[k]={});
    Object.keys(subs).forEach(function(s){nb[s]=syncJson(subs[s]); if(nb[s]!==b[s])m[s]=now;});
    Object.keys(b).forEach(function(s){if(!Object.prototype.hasOwnProperty.call(nb,s))m[s]=now;});
    meta.base[k]=nb;
  });
}
/* After a merge: the base becomes what S now is, so what arrived from
   the account is not mistaken for a change here. Only an entry with no
   time at all (this device's own, on its first sync) is stamped now. */
function syncRebase(o,meta,cur,now){
  syncKeys(o,cur,meta.base).forEach(function(k){
    const mode=syncMode(o,k), v=cur[k];
    if(mode==="whole"){meta.base[k]=syncJson(v); if(!meta.m[k])meta.m[k]=now; return;}
    const subs=syncSubs(o,k,mode,v), nb={}, m=meta.m[k]&&typeof meta.m[k]==="object"?meta.m[k]:(meta.m[k]={});
    Object.keys(subs).forEach(function(s){nb[s]=syncJson(subs[s]); if(!m[s])m[s]=now;});
    meta.base[k]=nb;
  });
}
/* Whether the merged key already stands in the account as it is, entry
   by entry and stamp by stamp, so that nothing needs writing. Order does
   not count: a map read back may list its entries in another order. */
function syncSame(o,k,v,m,rem){
  if(!rem)return false;
  const mode=syncMode(o,k);
  if(mode==="whole")return rem.has!==undefined&&rem.has===(v!==undefined)&&syncJson(rem.v)===syncJson(v===undefined?null:v)&&(rem.m||0)===(m||0);
  if(!rem.subs)return false;
  const ls=syncSubs(o,k,mode,v), lm=m&&typeof m==="object"?m:{};
  const a=Object.keys(ls), b=Object.keys(rem.subs), am=Object.keys(lm), bm=Object.keys(rem.m);
  if(a.length!==b.length||am.length!==bm.length)return false;
  return a.every(function(s){return Object.prototype.hasOwnProperty.call(rem.subs,s)&&syncJson(ls[s])===syncJson(rem.subs[s]);})&&
    am.every(function(s){return rem.m[s]===lm[s];});
}
/* Merge one key. Later stamp wins, entry by entry; an entry with no
   stamp here (never synced from this device) loses to one the account
   has. Returns {v, m}. */
function syncMergeKey(o,k,loc,lm,rem){
  const mode=syncMode(o,k);
  if(mode==="whole"){
    if(!rem||!rem.has)return {v:loc,m:lm||0};
    return (rem.m||0)>(lm||0)?{v:rem.v,m:rem.m}:{v:loc,m:lm||0};
  }
  const ls=syncSubs(o,k,mode,loc), rs=rem&&rem.subs||{}, lt=lm&&typeof lm==="object"?lm:{}, rt=rem&&rem.m||{};
  const subs={}, m={}, order=[];
  const seen={};
  Object.keys(ls).concat(Object.keys(rs),Object.keys(lt),Object.keys(rt)).forEach(function(s){
    if(seen[s])return; seen[s]=1;
    const a=lt[s]||0, b=rt[s]||0;
    const fromR=b>a||(b===a&&!Object.prototype.hasOwnProperty.call(ls,s));
    const src=fromR?rs:ls, t=fromR?b:a;
    if(t)m[s]=t;
    if(Object.prototype.hasOwnProperty.call(src,s)){subs[s]=src[s];order.push(s);}
  });
  return {v:syncBuild(mode,subs,order),m:m};
}
/* The documents for one key, as {id: data}. A map or set is split into
   buckets when it is large; any bucket into chunks. */
function syncDocs(o,k,v,m){
  const mode=syncMode(o,k), out={};
  const put=function(b,body){
    const s=JSON.stringify(body), n=Math.max(1,Math.ceil(s.length/SYNC_CHUNK)), h=syncHash(s);
    for(let i=0;i<n;i++)out[k+"."+b+"."+i]={k:k,b:String(b),i:i,n:n,h:h,c:s.slice(i*SYNC_CHUNK,(i+1)*SYNC_CHUNK)};
  };
  if(mode==="whole"){put("w",{v:v===undefined?null:v,has:v!==undefined,m:m||0});return out;}
  const subs=syncSubs(o,k,mode,v), mm=m&&typeof m==="object"?m:{};
  const size=syncJson(subs).length+syncJson(mm).length, B=size>SYNC_BIG?SYNC_BUCKETS:1;
  const parts=[];for(let b=0;b<B;b++)parts.push({v:{},m:{},o:[],B:B});
  Object.keys(subs).forEach(function(s){const p=parts[syncBucket(s,B)];p.v[s]=subs[s];p.o.push(s);});
  Object.keys(mm).forEach(function(s){parts[syncBucket(s,B)].m[s]=mm[s];});
  parts.forEach(function(p,b){put(b,p);});
  return out;
}
/* Read the documents back into {k: {has, v, m} or {subs, m, order}}.
   A bucket with a missing or torn chunk is left out and its key named
   in `torn`: it is not merged, and this device writes its own copy back
   whole, which repairs it. */
function syncRead(o,docs){
  const g={}, out={}, torn={};
  docs.forEach(function(d){if(d&&typeof d.k==="string"&&typeof d.c==="string"){(g[d.k+"|"+d.b]=g[d.k+"|"+d.b]||[]).push(d);}});
  Object.keys(g).forEach(function(gk){
    const ds=g[gk].sort(function(a,b){return a.i-b.i;}), d0=ds[0], k=d0.k;
    let body=null;
    const ok=ds.length===d0.n&&ds.every(function(d,i){return d.i===i&&d.h===d0.h&&d.n===d0.n;});
    if(ok){const s=ds.map(function(d){return d.c;}).join("");if(syncHash(s)===d0.h)try{body=JSON.parse(s);}catch(e){body=null;}}
    if(!body){torn[k]=1;return;}
    if(d0.b==="w"){out[k]={has:body.has!==false,v:body.v,m:body.m||0};return;}
    const r=out[k]||(out[k]={subs:{},m:{},order:[]});
    Object.keys(body.v||{}).forEach(function(s){r.subs[s]=body.v[s];});
    (body.o||Object.keys(body.v||{})).forEach(function(s){r.order.push(s);});
    Object.keys(body.m||{}).forEach(function(s){r.m[s]=body.m[s];});
  });
  /* A bucket missing altogether needs no guard: its entries are simply
     absent with no stamp, so the device that has them keeps them and
     writes them back on its next sync. */
  return {keys:out,torn:torn};
}

/* --- the running part ---------------------------------------------------- */
function syncMetaLoad(){
  try{const r=localStorage.getItem(SYNC.o.key+":sync"); const x=r&&JSON.parse(r); if(x&&typeof x==="object"&&x.base&&x.m)return x;}catch(e){}
  return null;
}
function syncMetaSave(){try{localStorage.setItem(SYNC.o.key+":sync",JSON.stringify(SYNC.meta));}catch(e){}}
function syncSay(st,msg){SYNC.st=st;SYNC.msg=msg||"";if(SYNC.o&&SYNC.o.status)try{SYNC.o.status();}catch(e){}}

/* o: {app, key, get:()=>S, set:(k,v)=>…, maps:[…], sets:{k: idFn|null},
   local:[…], fix(S), after(changed), status()}. Called once, after load(). */
function syncStart(o){
  SYNC={st:"off",at:0,msg:"",o:o,db:null,uid:null,meta:null,timer:0,busy:false,again:false,ro:false};
  if(typeof window==="undefined"||!window.claude||typeof window.claude.use!=="function")return;
  syncSay("wait");
  Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){
    const db=r[0], user=r[1];
    if(!db||!user){syncSay("off");return null;}
    return user.id().then(function(uid){
      if(!uid){syncSay("noid");return;}
      SYNC.db=db; SYNC.uid=uid;
      const meta=syncMetaLoad();
      /* Another account's progress already on this browser: leave both
         alone rather than pour one account into the other. */
      if(meta&&meta.uid&&meta.uid!==uid){syncSay("other");return;}
      SYNC.meta=meta||{uid:uid,base:{},m:{},ids:{},first:true};
      SYNC.meta.uid=uid;
      if(typeof document!=="undefined"&&document.addEventListener)try{
        document.addEventListener("visibilitychange",function(){syncNow();});
      }catch(e){}
      return syncNow();
    });
  }).catch(function(){syncSay("off");});
}
/* Every save lands here: the next sync is a few seconds away, so a burst
   of saves during a sitting is one write, not twenty. */
function syncTouch(){
  if(!SYNC.meta)return;
  if(SYNC.timer)clearTimeout(SYNC.timer);
  SYNC.timer=setTimeout(function(){SYNC.timer=0;syncNow();},SYNC_WAIT);
}
function syncCol(){return SYNC.db.collection("data/users/"+SYNC.uid+"/"+SYNC.o.app+"/k");}
/* Pull, merge, push. One at a time: a call while one runs is folded into
   one more pass after it. */
function syncNow(){
  if(!SYNC.meta||!SYNC.db)return Promise.resolve();
  if(SYNC.busy){SYNC.again=true;return SYNC.busy;}
  const o=SYNC.o, meta=SYNC.meta;
  SYNC.busy=syncCol().get().then(function(snap){
    const docs=[], ids={};
    snap.docs.forEach(function(d){if(d.exists){const x=d.data(); if(x){docs.push(x); ids[d.id]=1;}}});
    meta.ids=ids;
    const S0=o.get();
    /* On the first sync nothing here is stamped yet, so whatever the
       account holds wins where both have an entry. */
    if(meta.first){meta.base={};meta.m={};}
    else syncStamp(o,meta,S0,Date.now());
    const rd=syncRead(o,docs), now=Date.now();
    let changed=false;
    const push={};
    syncKeys(o,S0,rd.keys).forEach(function(k){
      if(rd.torn[k]){push[k]=1;return;}
      const r=syncMergeKey(o,k,S0[k],meta.m[k],rd.keys[k]);
      if(syncJson(r.v)!==syncJson(S0[k])){o.set(k,r.v);changed=true;}
      meta.m[k]=r.m;
    });
    if(changed&&o.fix)o.fix(o.get());
    /* The first sync stamps everything it keeps that has no time yet,
       so the next device to link sees this one's progress as real. */
    const S1=o.get();
    syncRebase(o,meta,S1,now);
    meta.first=false;
    syncKeys(o,S1,rd.keys).forEach(function(k){if(!rd.torn[k]&&!syncSame(o,k,S1[k],meta.m[k],rd.keys[k]))push[k]=1;});
    return syncPush(Object.keys(push)).then(function(){
      SYNC.at=Date.now(); syncMetaSave();
      syncSay(SYNC.ro?"ro":"on");
      if(changed&&o.after)o.after(true);
    });
  }).catch(function(e){
    const c=e&&e.code;
    if(c==="quota_exceeded")syncSay("full");
    else if(c==="revoked"||c==="not_granted"||c==="capability_disabled"||c==="capability_removed"){syncSay("off");SYNC.meta=null;}
    else syncSay("err",c||"");
  }).then(function(){
    SYNC.busy=false;
    if(SYNC.again){SYNC.again=false;return syncNow();}
  });
  return SYNC.busy;
}
/* Write every document of the given keys, one at a time, then delete the
   ones those keys no longer use. A refused write means this account may
   read here but not save: say so, and stop trying. */
function syncPush(keys){
  if(SYNC.ro||!keys.length)return Promise.resolve();
  const o=SYNC.o, S1=o.get(), col=syncCol(), want={}, writes=[];
  keys.forEach(function(k){
    const d=syncDocs(o,k,S1[k],SYNC.meta.m[k]);
    Object.keys(d).forEach(function(id){want[id]=1;writes.push([id,d[id]]);});
  });
  const drop=Object.keys(SYNC.meta.ids).filter(function(id){return !want[id]&&keys.indexOf(id.split(".")[0])>-1;});
  let p=Promise.resolve();
  writes.forEach(function(w){p=p.then(function(){return col.doc(w[0]).set(w[1]).then(function(){SYNC.meta.ids[w[0]]=1;});});});
  drop.forEach(function(id){p=p.then(function(){return col.doc(id).delete().then(function(){delete SYNC.meta.ids[id];});});});
  return p.catch(function(e){if(e&&e.code==="invalid_argument"){SYNC.ro=true;return;}throw e;});
}
