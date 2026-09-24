/* Shared by the course (src/) and the children's app (kids/). Both builds
   concatenate this file, so a fix here reaches both. Pure: no screen, no
   saved state, nothing either app's own code has to exist for. */

/* ===================== ortak · review ladder ===================== */
/* The spaced-review ladder, in days: box 0 is today, then 1, 2, 4 ... */
const STEPS=[0,1,2,4,8,16,32,64,120];
function dayNum(){return Math.floor(Date.now()/86400000);}
/* Words and produced sentences climb the same ladder in different
   stores, so the box arithmetic lives here once. next() is given the
   current box and returns the new one. */
function isDue(map,k){const r=map&&map[k];return !r||r.d<=dayNum();}
function bump(map,k,next){
  const r=map[k]||{b:0,d:dayNum(),f:dayNum()};   /* f: the day it was first practised */
  r.b=Math.max(0,Math.min(next(r.b),STEPS.length-1));
  r.d=dayNum()+STEPS[r.b];
  map[k]=r; return r;
}
/* How many never-practised items in a map were first practised today,
   optionally only keys under one prefix: the count a daily allowance of
   new items is measured against (the course's NEW_DAY, the kids' own). */
function newToday(map,pfx){
  const n=dayNum(); let c=0;
  if(map)for(const k in map){const r=map[k]; if(r&&r.f===n&&(!pfx||k.indexOf(pfx)===0))c++;}
  return c;
}
/* Everything due now: reviews oldest first, then as many never-practised
   items, in the bank's own order, as today's allowance still admits. */
function dueItems(map,bank,cap,pfx){
  const n=dayNum(), old=[], fresh=[];
  bank.forEach(function(it){
    const r=map&&map[it.k];
    if(r){if(r.d<=n)old.push(it);}else fresh.push(it);
  });
  old.sort(function(x,y){return map[x.k].d-map[y.k].d;});
  return old.concat(cap===undefined?fresh:fresh.slice(0,Math.max(0,cap-newToday(map,pfx))));
}
function dueQueue(map,bank,limit,cap,pfx){return dueItems(map,bank,cap,pfx).slice(0,limit);}
