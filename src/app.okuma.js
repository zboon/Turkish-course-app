/* Okuma: every passage in the course on one shelf, to read for its own sake. */

/* ===================== okuma · the reading shelf ===================== */
/* Each unit has one passage, on its Okuma tab, and until now that tab
   was the only way to it: sixty texts from Nasreddin Hoca to the
   Mesnevî, reachable one unit at a time. The learner asked for a place
   to just read them. So this is the shelf: every passage, graded A1 to
   C2 in course order, with the folk-tale thread (Nasreddin Hoca, the
   tales, Dede Korkut, Karagöz, the Mesnevî) available as a filter.

   A passage opens exactly as on its tab (the same readPassage(): the
   voice bar, a line's English on a tap, the glossed words), because
   playback reads readable(V.u) and the reader sets V.u.

   Above the units sit the Nasreddin Hoca tales (HIKAYE), twelve short
   ones for A1 and A2, because the course had no story at A1. They are
   reading only: no unit, no drill, nothing scheduled.

   READING AHEAD IS ALLOWED, AND WRITES NOTHING
   A locked unit's passage can be read here, marked "ileride". The shelf
   calls no markSeen(), so reading it does not open the unit, count its
   lines as met or feed them to Üretim and Dinleme: the path and "nothing
   reviews what has not been met" both hold, and reading for fun stays
   free of consequences. A passage read on its unit's tab shows a tick. */
let OKF="all";
const OK_FOLK=/Halk|Dede Korkut|Karagöz|Mesnev|halk hikâyesi/;
function okFolk(u){return OK_FOLK.test(u.read.kind);}
/* The Nasreddin Hoca tales come first, as the easiest reading on the
   shelf, then the units' passages. Every tale is a folk tale. */
function okList(){return HIKAYE.concat(UNITS.filter(function(u){return OKF!=="folk"||okFolk(u);}));}
function okTale(x){return HIKAYE.indexOf(x)>-1;}
/* A tale is ahead until the grammar it leans on has been read, which is
   the grain the reviews use (metGram). */
function okTaleOpen(x){return metGram(x.u);}
function okAhead(x){return okTale(x)?!okTaleOpen(x):!unitOpen(x.id);}
function okumaOpen(){OKF=OKF||"all";go("okuma");}
function okSet(f){OKF=f;render();}
function okRead(id){go("okumaoku",id);}
/* What a passage is, in a few words: the label before its first " · ". */
function okKind(u){return u.read.kind.split(" · ")[0];}
function renderOkuma(){
  let h=bar("Okuma","read for fun",true,"keyifle oku")+'<div class="wrap">';
  h+='<p class="sub" style="margin:.2rem .2rem 1rem">'+tx('Every passage in the course, from the first to the last. Read any of them, in any order, as often as you like. Nothing here counts as a lesson or changes your reviews.',
    'Kurstaki bütün metinler, ilkinden sonuncusuna. Hangisini istersen, istediğin sırayla, istediğin kadar oku. Burada hiçbir şey ders sayılmaz, tekrarlarını da değiştirmez.')+'</p>';
  h+='<div class="segs"><button class="'+(OKF!=="folk"?'on':'')+'" onclick="okSet(\'all\')">Hepsi<i><span class="gl">all</span></i></button>'+
    '<button class="'+(OKF==="folk"?'on':'')+'" onclick="okSet(\'folk\')">Halk anlatıları<i><span class="gl">folk tales</span></i></button></div>';
  const list=okList();
  h+='<h2 class="sec">Nasreddin Hoca</h2><p class="tiny" style="margin:0 .2rem .6rem">'+
    tx('Twelve short tales, the easiest reading here: six at A1 in the present tense, six at A2 in the past.',
       'On iki kısa fıkra, buradaki en kolay okuma: altısı A1’de şimdiki zamanla, altısı A2’de geçmiş zamanla.')+'</p>';
  HIKAYE.forEach(function(x){
    h+='<button class="card nav row okrow" onclick="okRead(\''+x.id+'\')"><div class="grow"><p class="lead nav-t">'+esc(x.read.t)+'</p>'+
      '<p class="sub">'+esc(x.lv+' · fıkra '+x.n)+'</p></div>'+
      (okAhead(x)?'<span class="pill">ileride</span>':'')+
      '<span class="chev">'+IC.chev+'</span></button>';
  });
  LEVELS.forEach(function(l){
    const us=list.filter(function(u){return !okTale(u)&&u.lv===l.id;});
    if(!us.length)return;
    h+='<h2 class="sec">'+esc(l.id+' · '+l.tr)+'</h2>';
    us.forEach(function(u){
      const read=seenSec(u.id,"r")||isDone(u.id), ahead=okAhead(u);
      h+='<button class="card nav row okrow" onclick="okRead(\''+u.id+'\')"><div class="grow"><p class="lead nav-t">'+esc(u.read.t)+'</p>'+
        '<p class="sub">'+esc(u.lv+' · '+u.n+' · '+okKind(u))+'</p></div>'+
        (read?'<span class="pill turk">✓</span>':ahead?'<span class="pill">ileride</span>':'')+
        '<span class="chev">'+IC.chev+'</span></button>';
    });
  });
  h+='</div>';
  paint(h);
}
function renderOkumaOku(){
  const u=readable(V.u);
  if(!u){go("okuma");return;}
  const list=okList(), at=list.findIndex(function(x){return x.id===u.id;});
  const prev=at>0?list[at-1]:null, next=at>-1&&at<list.length-1?list[at+1]:null;
  const tale=okTale(u);
  let h=bar(u.read.t,tale?u.lv+" · Nasreddin Hoca · "+u.n:u.lv+" · "+u.n+" · "+u.tr,true)+'<div class="wrap">';
  if(tale&&!okTaleOpen(u)){
    const g=unit(u.u);
    h+='<p class="tiny adamsg">'+tx('It uses grammar you have not read yet ('+esc(g.lv+' · '+g.tr)+'). Read it for fun; the words to tap will help.',
      'Henüz okumadığın bir dilbilgisi var ('+esc(g.lv+' · '+g.tr)+'). Keyfine oku; altı noktalı kelimeler yardım eder.')+'</p>';
  }else if(!tale&&!unitOpen(u.id))h+='<p class="tiny adamsg">'+tx('Ahead of where you are. Read it for fun; it does not open the unit.','Şu an bulunduğun yerin ilerisinde. Keyfine oku; üniteyi açmaz.')+'</p>';
  h+=readPassage(u);
  h+='<div class="btn-row" style="margin-top:1rem">'+
    (prev?'<button class="btn ghost" onclick="okRead(\''+prev.id+'\')">‹ '+esc(prev.read.t)+'</button>':'<span class="grow"></span>')+
    (next?'<button class="btn ghost" onclick="okRead(\''+next.id+'\')">'+esc(next.read.t)+' ›</button>':'<span class="grow"></span>')+'</div>';
  if(!tale&&unitOpen(u.id))h+='<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'r\')">Üniteye git · open the unit</button>';
  h+='</div>';
  paint(h);
}
