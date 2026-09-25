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
   playback reads unit(V.u) and the reader sets V.u.

   READING AHEAD IS ALLOWED, AND WRITES NOTHING
   A locked unit's passage can be read here, marked "ileride". The shelf
   calls no markSeen(), so reading it does not open the unit, count its
   lines as met or feed them to Üretim and Dinleme: the path and "nothing
   reviews what has not been met" both hold, and reading for fun stays
   free of consequences. A passage read on its unit's tab shows a tick. */
let OKF="all";
const OK_FOLK=/Halk|Dede Korkut|Karagöz|Mesnev|halk hikâyesi/;
function okFolk(u){return OK_FOLK.test(u.read.kind);}
function okList(){return UNITS.filter(function(u){return OKF!=="folk"||okFolk(u);});}
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
  LEVELS.forEach(function(l){
    const us=list.filter(function(u){return u.lv===l.id;});
    if(!us.length)return;
    h+='<h2 class="sec">'+esc(l.id+' · '+l.tr)+'</h2>';
    us.forEach(function(u){
      const read=seenSec(u.id,"r")||isDone(u.id), ahead=!unitOpen(u.id);
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
  const u=unit(V.u);
  if(!u){go("okuma");return;}
  const list=okList(), at=list.findIndex(function(x){return x.id===u.id;});
  const prev=at>0?list[at-1]:null, next=at>-1&&at<list.length-1?list[at+1]:null;
  let h=bar(u.read.t,u.lv+" · "+u.n+" · "+u.tr,true)+'<div class="wrap">';
  if(!unitOpen(u.id))h+='<p class="tiny adamsg">'+tx('Ahead of where you are. Read it for fun; it does not open the unit.','Şu an bulunduğun yerin ilerisinde. Keyfine oku; üniteyi açmaz.')+'</p>';
  h+=readPassage(u);
  h+='<div class="btn-row" style="margin-top:1rem">'+
    (prev?'<button class="btn ghost" onclick="okRead(\''+prev.id+'\')">‹ '+esc(prev.read.t)+'</button>':'<span class="grow"></span>')+
    (next?'<button class="btn ghost" onclick="okRead(\''+next.id+'\')">'+esc(next.read.t)+' ›</button>':'<span class="grow"></span>')+'</div>';
  if(unitOpen(u.id))h+='<button class="btn ghost" onclick="go(\'unit\',\''+u.id+'\',\'r\')">Üniteye git · open the unit</button>';
  h+='</div>';
  paint(h);
}
