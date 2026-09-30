/* Shared by the course (src/) and the children's app (kids/). Both builds
   concatenate this file. Nothing here knows a screen: each app hands
   navInit() two questions, whether it is on its home screen and how its own
   back arrow goes, and calls navSync() at the end of render(). */

/* ===================== ortak · the phone's back button ===================== */
/* The app is one page that redraws itself, so the browser has one history
   entry for all of it and the phone's back button, which walks that
   history, leaves the app from any screen at all. So while the learner is
   anywhere but home, one extra entry is held above the app's own. Back
   spends that entry instead of leaving, and popstate answers it the way
   the back arrow does. When the arrow's answer is home the entry is not
   put back, and the next press leaves, which is what back on a home
   screen is for.

   Nothing is added to the address and nothing is stored. Where there is no
   history to use (a test, an old webview) it does nothing at all. */
const NAV={on:false,held:false,home:null,back:null};
function navInit(isHome,goBack){
  NAV.home=isHome;NAV.back=goBack;
  NAV.on=typeof history!=="undefined"&&!!history.pushState&&typeof window!=="undefined"&&!!window.addEventListener;
  if(NAV.on)window.addEventListener("popstate",navPop);
}
/* Called at the end of every render: away from home with no entry held,
   hold one. Cheap, and it needs no bookkeeping in the screens. */
function navSync(){
  if(!NAV.on||NAV.held||NAV.home())return;
  try{history.pushState({turkce:1},"");NAV.held=true;}catch(e){NAV.on=false;}
}
function navPop(){
  if(!NAV.on)return;
  NAV.held=false;
  if(NAV.home()){
    /* Home again by the home button, with the entry still held: the press
       has spent it, so pass it on and leave. */
    try{history.back();}catch(e){}
  }else NAV.back();
}
