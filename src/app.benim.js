/* Kendi kelimelerim: the words the learner meets in the wild. */

/* ===================== benim · my own words ===================== */
/* Until now the only way into the review queue was a star beside a word
   the course had already chosen — so a word met on a sign, in a shop or
   in a subtitle could not get in, and the app was a closed box.

   It adds **no new queue**. `S.star` and `S.srs` already are the spaced
   queue, `dueList()` already feeds Sözlüğüm's review and the flashcards,
   and the daily plan's Tekrar step already counts them. So a word added
   here is starred like any other and turns up in Bugün tomorrow with no
   machinery at all. `S.mine` exists only because `S.star` holds bare
   "tr|en" strings: unstar a word and it would otherwise vanish, and the
   dictionary would have nothing to list.

   What it deliberately does NOT feed is Tekrar motoru. That engine
   counts how often the app's own corpus mentions a word and drills the
   worst served; a word the learner brought has zero mentions by
   definition, so every one of them would sit permanently at the top and
   bury the course vocabulary the engine exists to rescue. User words
   ride the star queue, which is a plan step already. The screen says
   so. */
const MINE_MAX=500;
let MW=null;                         /* index being edited, across renders */
/* The message has to survive the re-render that follows it. Poking the
   DOM alone was silently useless: every path that sets a message ends in
   render(), which replaces the element it was just written into, so the
   learner saw nothing at all. */
let MMSG="";

/* User input, unlike the course data, arrives by paste. A soft hyphen or
   a zero-width space inside a word looks perfect on screen and breaks
   every match it touches — validate.js checks the course data for
   exactly this, and here it has to be done at the door. */
function cleanWord(s){
  return String(s==null?"":s)
    .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g,"")
    .replace(/[\u0000-\u001F\u007F]/g,"")
    .replace(/\s+/g," ").trim().slice(0,80);
}
function mineList(){if(!S.mine)S.mine=[];return S.mine;}
function mineMsg(t){MMSG=t||"";const e=document.getElementById("mmsg");if(e)e.textContent=MMSG;}
function mineFind(tr){
  const f=fold(tr);
  return mineList().filter(function(e){return fold(e.tr)===f;})[0];
}
/* Already in the course or the everyday list? Then the honest thing is
   not a second copy but a star on the one that is already there. */
function mineTaught(tr){
  const f=fold(tr);
  return dictAll().filter(function(w){return w.src!=="mine"&&fold(w.tr)===f;})[0];
}
function mineVal(id){const e=document.getElementById(id);return cleanWord(e?e.value:"");}
function mineOpen(){MW=null;MMSG="";go("mine");}
function mineAdd(){
  MMSG="";
  const tr=mineVal("mtr"), en=mineVal("men"), note=mineVal("mnote");
  if(!tr||!en){mineMsg(txt("Both sides are needed — the Turkish and what it means.","İki taraf da gerekli: Türkçesi ve anlamı."));return;}
  if(mineList().length>=MINE_MAX){mineMsg(txt("That is "+MINE_MAX+" of your own words, which is the limit.","Kendi kelimelerin "+MINE_MAX+" tane oldu; sınır bu."));return;}
  const taught=mineTaught(tr);
  if(taught){
    setStar(taught.tr,taught.en,true);save();
    mineMsg(txt("“"+taught.tr+"” is already in the course — starred that one instead of making a second copy.","“"+taught.tr+"” zaten kursta var; ikinci bir kopya yerine o yıldızlandı."));
    render();return;
  }
  if(mineFind(tr)){mineMsg(txt("“"+tr+"” is already in your list.","“"+tr+"” zaten listende."));return;}
  mineList().push({tr:tr,en:en,note:note,at:dayNum()});
  setStar(tr,en,true);
  save();MW=null;render();
}
/* An edit is usually a typo fix, and the star key is built from the
   spelling — so re-keying would quietly drop a word to box 0 after a
   month of reviews. Carry the schedule across instead. */
function mineRekey(oldK,newK){
  if(oldK===newK)return;
  const was=S.srs&&S.srs[oldK], had=S.star.indexOf(oldK)>-1;
  dropStar(oldK);
  if(had){
    addStar(newK);
    if(was&&S.srs[newK]){S.srs[newK].b=was.b;S.srs[newK].d=was.d;}
  }
}
function mineEdit(i){MW=i;render();}
function mineCancel(){MW=null;MMSG="";render();}
function mineSave(i){
  MMSG="";
  const e=mineList()[i]; if(!e)return;
  const tr=mineVal("mtr"), en=mineVal("men"), note=mineVal("mnote");
  if(!tr||!en){mineMsg("Both sides are needed.");return;}
  const clash=mineFind(tr);
  if(clash&&clash!==e){mineMsg(txt("“"+tr+"” is already in your list.","“"+tr+"” zaten listende."));return;}
  mineRekey(starKey(e.tr,e.en),starKey(tr,en));
  e.tr=tr;e.en=en;e.note=note;
  save();MW=null;render();
}
function mineDrop(i){
  const e=mineList()[i]; if(!e)return;
  if(typeof confirm==="function"&&!confirm(txt("Remove “"+e.tr+"” from your words? It leaves the review queue too.","“"+e.tr+"” kelimelerinden çıkarılsın mı? Tekrar sırasından da çıkar.")))return;
  setStar(e.tr,e.en,false);
  mineList().splice(i,1);
  save();MW=null;render();
}
function mineStar(i){
  const e=mineList()[i]; if(!e)return;
  setStar(e.tr,e.en,!isStarred(e.tr,e.en));
  save();render();
}

/* --- screen ----------------------------------------------------------- */
function renderMine(){
  const all=mineList(), ed=(MW!==null&&all[MW])?all[MW]:null;
  const due=all.filter(function(e){return isStarred(e.tr,e.en)&&isDue(S.srs,starKey(e.tr,e.en));}).length;
  let h=bar("Kendi kelimelerim","words you met in the wild",true,"dışarıda karşılaştığın kelimeler")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('A word off a sign, out of a subtitle, or from someone talking to you. Added here it is starred like any other, so it rides the same spaced queue and turns up in <b>Bugün</b> under Tekrar — nothing else to set up.',
    'Bir tabeladan, bir altyazıdan ya da biriyle konuşurken öğrendiğin bir kelime. Buraya eklenince öteki kelimeler gibi yıldızlanır, aynı tekrar sırasına girer ve <b>Bugün</b> listesinde Tekrar altında çıkar; başka bir ayar gerekmez.')+'</p>';
  if(all.length)h+='<div class="stat"><div><b>'+all.length+'</b><span>kelime</span></div>'+
     '<div><b>'+due+'</b><span>bugün</span></div>'+
     '<div><b>'+S.star.length+'</b><span>toplam yıldız</span></div></div>';

  h+='<h2 class="sec">'+(ed?"Düzenle":"Ekle")+'</h2><div class="card">';
  h+='<input class="inp" id="mtr" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" '+
   'placeholder="Türkçe" value="'+esc(ed?ed.tr:"")+'">';
  h+='<input class="inp" id="men" style="margin-top:.5rem" autocapitalize="off" autocomplete="off" '+
   'placeholder="'+txt("what it means","anlamı")+'" value="'+esc(ed?ed.en:"")+'">';
  h+='<input class="inp" id="mnote" style="margin-top:.5rem" autocapitalize="off" autocomplete="off" '+
   'placeholder="nerede gördün? · where you met it (optional)" value="'+esc(ed&&ed.note?ed.note:"")+'">';
  if(ed){
    h+='<div class="btn-row"><button class="btn ghost" onclick="mineCancel()">Vazgeç</button>'+
     '<button class="btn" onclick="mineSave('+MW+')">Kaydet</button></div>';
  }else{
    h+='<button class="btn" onclick="mineAdd()">Ekle ve tekrara al</button>';
  }
  h+='<p class="tiny" id="mmsg" style="margin-top:.5rem;min-height:1.1em">'+esc(MMSG)+'</p>';
  h+='<p class="tiny">'+tx('Adding a word the course already teaches stars that one rather than making a second copy.','Kursun zaten öğrettiği bir kelimeyi eklersen ikinci bir kopya yapılmaz, o kelime yıldızlanır.')+'</p></div>';

  if(all.length){
    h+='<h2 class="sec">Listem</h2><div class="card" style="padding:.3rem 1rem">';
    all.slice().reverse().forEach(function(e,ri){
      const i=all.length-1-ri, on=isStarred(e.tr,e.en);
      h+='<div class="vrow">'+spkBtn(e.tr,{aria:"Listen"})+
        '<div class="grow"><div class="vtr">'+esc(e.tr)+'</div>'+
        '<div class="ven">'+esc(e.en)+(e.note?' · <i>'+esc(e.note)+'</i>':'')+'</div></div>'+
        '<button class="sbtn" onclick="mineEdit('+i+')">düzenle</button>'+
        '<button class="sbtn" onclick="mineDrop('+i+')">×</button>'+
        starBtn(on,"mineStar("+i+")","Review queue")+'</div>';
    });
    h+='</div>';
    h+='<button class="btn ghost" onclick="go(\'words\')">Sözlüğüm · review them</button>';
  }else{
    h+='<div class="empty">Henüz kendi kelimen yok.<br>'+tx('Add the first one above.','İlkini yukarıdan ekle.')+'</div>';
  }
  h+='<p class="foot">'+tx('These ride the starred-word queue, not Tekrar motoru.<br>That engine counts how often the course itself uses a word, and a word you brought has no count to improve.',
    'Bunlar Tekrar motoruna değil, yıldızlı kelime sırasına girer.<br>O motor kursun bir kelimeyi kaç kez kullandığını sayar; senin getirdiğin kelimenin öyle bir sayısı yok.')+'</p></div>';
  paint(h);
  const box=document.getElementById("mtr");
  if(box){
    box.addEventListener("keydown",function(ev){if(ev.key==="Enter")ed?mineSave(MW):mineAdd();});
  }
}
