/* Shared by the course (src/) and the children's app (kids/). Both builds
   concatenate this file, so a fix here reaches both. Pure: no screen, no
   saved state, nothing either app's own code has to exist for. */

/* ===================== ortak · voice ===================== */
const VOICE={rate:0.85,mode:null,idx:0,tid:null,ready:false};
function ttsOK(){return typeof window!=="undefined"&&"speechSynthesis"in window;}
function trVoice(){
  if(!ttsOK())return null;
  let vs=[];try{vs=speechSynthesis.getVoices()||[];}catch(e){}
  return vs.find(v=>/^tr/i.test(v.lang))||null;
}
/* The middle answer is the one that matters. A device with speech but no
   Turkish voice does not fall silent: it reads Turkish in its default
   voice, so a beginner hears Merhaba in an English accent from lesson one
   and nothing says so. "unknown" is a voice list not loaded yet, and says
   nothing rather than warn on a device that is fine. */
function voiceState(){
  if(!ttsOK())return "none";
  let vs=[];try{vs=speechSynthesis.getVoices()||[];}catch(e){}
  if(!vs.length)return "unknown";
  return vs.some(v=>/^tr/i.test(v.lang))?"ok":"notr";
}
/* The device's own speech. lang omitted means Turkish, in the Turkish
   voice when there is one; vol is 0–1 and optional. */
function say(text,rate,onend,lang,vol){
  if(!ttsOK())return false;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const v=lang?null:trVoice(); if(v)u.voice=v;
    u.lang=lang||"tr-TR"; u.rate=rate||VOICE.rate;
    if(vol!==undefined)u.volume=vol;
    if(onend)u.onend=onend;
    speechSynthesis.speak(u); return true;
  }catch(e){return false;}
}
