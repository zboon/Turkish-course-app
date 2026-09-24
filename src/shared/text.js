/* Shared by the course (src/) and the children's app (kids/). Both builds
   concatenate this file, so a fix here reaches both. Pure: no screen, no
   saved state, nothing either app's own code has to exist for. */

/* ===================== ortak · text ===================== */
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fold(s){
  return String(s).replace(/İ/g,"i").replace(/I/g,"i").replace(/ı/g,"i").replace(/Ş/g,"s").replace(/ş/g,"s")
   .replace(/Ğ/g,"g").replace(/ğ/g,"g").replace(/Ü/g,"u").replace(/ü/g,"u").replace(/Ö/g,"o").replace(/ö/g,"o")
   .replace(/Ç/g,"c").replace(/ç/g,"c").replace(/[âÂ]/g,"a").replace(/[îÎ]/g,"i").replace(/[ûÛ]/g,"u")
   .toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}

/* ===================== ortak · letter tiles ===================== */
/* Spelling a word from letter tiles, used by the children's app and by the
   course's Adım adım. */
/* The decoys are the letters a beginner confuses: ı for i, ş for s,
   ç for c — spelling with tiles is where ç and ş get learned. */
const TWINS={"ı":"i","i":"ı","ş":"s","s":"ş","ç":"c","c":"ç","ğ":"g","g":"ğ","ö":"o","o":"ö","ü":"u","u":"ü","â":"a"};
function spellTiles(tr){
  const letters=tr.split(""), decoys=[];
  letters.forEach(function(l){const t=TWINS[l]; if(decoys.length<2&&t&&letters.indexOf(t)<0&&decoys.indexOf(t)<0)decoys.push(t);});
  const pool="aeiıoöuübcçdfgğhjklmnprsştvyz";
  while(decoys.length<2){const c=pool[Math.floor(Math.random()*pool.length)]; if(letters.indexOf(c)<0&&decoys.indexOf(c)<0)decoys.push(c);}
  return shuffle(letters.concat(decoys));
}
