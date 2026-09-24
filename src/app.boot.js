/* The render dispatch and start-up. Last in the build: everything it
   names has to exist by the time these lines run. */

/* ===================== boot ===================== */
function render(){
  const v=V.view;
  if(v==="home")renderHome();
  else if(v==="level")renderLevel();
  else if(v==="unit")renderUnit();
  else if(v==="quiz")renderQuiz();
  else if(v==="words")renderWords();
  else if(v==="cards")renderCards();
  else if(v==="review")renderReview();
  else if(v==="about")renderAbout();
  else if(v==="prod")renderProd();
  else if(v==="prodrun")renderProdRun();
  else if(v==="retell")renderRetell();
  else if(v==="retelldone")renderRetellDone();
  else if(v==="ilerleme")renderIlerleme();
  else if(v==="dict")renderDict();
  else if(v==="dinle")renderDinle();
  else if(v==="dinlerun")renderDinleRun();
  else if(v==="tekrar")renderTekrar();
  else if(v==="tekrarrun")renderTekrarRun();
  else if(v==="gram")renderGram();
  else if(v==="gramrun")renderGramRun();
  else if(v==="yolda")renderYolda();
  else if(v==="yoldarun")renderYoldaRun();
  else if(v==="hata")renderHata();
  else if(v==="mine")renderMine();
  else if(v==="sor")renderSor();
  else if(v==="sayilar")renderSayilar();
  else if(v==="sayilarrun")renderSayilarRun();
  else if(v==="diyalog")diaHub();
  else if(v==="diyalogrun")diaRun();
  else if(v==="ata")renderAta();
  else if(v==="atarun")renderAtaRun();
  else if(v==="sik")renderSik();
  else if(v==="dersler")renderDersler();
  else if(v==="araclar")renderAraclar();
  else if(v==="nasil")renderNasil();
  else if(v==="baslarken")renderBaslarken();
  else if(v==="basla")renderBasla();
  else if(v==="uyku")renderUyku();
  else if(v==="uykurun")renderUykuRun();
  else if(v==="adim")renderAdim();
  else if(v==="coz")renderCoz();
  else if(v==="cozrun")renderCozRun();
  else renderHome();
  /* The live clock arms itself where it is drawn and stops where it is
     not, so this one call covers every screen. */
  clockTick();
}
if(typeof navigator!=="undefined"&&navigator.serviceWorker&&typeof location!=="undefined"&&/^https?:/.test(location.protocol)){
  try{navigator.serviceWorker.register("sw.js").catch(function(){});}catch(e){}
}
load();
if(S.rate)VOICE.rate=S.rate;
if(S.theme)document.documentElement.setAttribute("data-theme",S.theme);
touchDay();
render();
