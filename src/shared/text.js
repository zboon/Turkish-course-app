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
