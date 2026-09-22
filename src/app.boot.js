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
  else if(v==="dict")renderDict();
  else if(v==="dinle")renderDinle();
  else if(v==="dinlerun")renderDinleRun();
  else if(v==="tekrar")renderTekrar();
  else if(v==="tekrarrun")renderTekrarRun();
  else if(v==="gram")renderGram();
  else if(v==="gramrun")renderGramRun();
  else if(v==="yolda")renderYolda();
  else if(v==="yoldarun")renderYoldaRun();
  else renderHome();
}
if(typeof navigator!=="undefined"&&navigator.serviceWorker&&typeof location!=="undefined"&&/^https?:/.test(location.protocol)){
  try{navigator.serviceWorker.register("sw.js").catch(function(){});}catch(e){}
}
load();
if(S.rate)VOICE.rate=S.rate;
if(S.theme)document.documentElement.setAttribute("data-theme",S.theme);
touchDay();
render();
