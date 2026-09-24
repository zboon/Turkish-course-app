/* Türkçe Macera — render dispatch and start-up. Last in the build. */

/* ===================== macera · boot ===================== */
function render(){
  const v=V.view;
  if(v==="unit")renderUnit();
  else if(v==="play")renderPlay();
  else if(v==="parents")renderParents();
  else renderHome();
}
/* A voice list that arrives after the first paint may change the voice
   note. Redraw for it only where nothing is being typed or played. */
if(ttsOK()){try{
  speechSynthesis.onvoiceschanged=function(){
    if(V.view==="unit"||(V.view==="home"&&S.name))render();
  };
  speechSynthesis.getVoices();
}catch(e){}}
load();
if(S.theme)document.documentElement.setAttribute("data-theme",S.theme);
render();
