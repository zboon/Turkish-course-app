/* Diyalog — service encounters that branch, for the mode whose whole point
   is carrying on when you did not catch something.

   Every line here is Özgün metin: written for this course, in the register
   a counter clerk or a stallholder actually uses, and kept to
   constructions the sixty units teach.

   SHAPE
     id        permanent, like a unit id — S.dia is keyed to it
     vars      slots resolved once per run, so the same skeleton is a
               different conversation each time and cannot be recited
     start     the first beat's key
     beats     a map of key → beat, so branches name where they go

   A BEAT
     say       what the other person says, with {slots}
     slow      the same thing, said again for a learner who asked; falls
               back to `say`. This is the FIRST repair the app offers.
     easy      a plainer rephrase, for the second repair. Optional.
     opts      what the learner may do, as English functions — they say the
               Turkish out loud, then it is shown and spoken
     want      instead of opts: the var whose digits must be typed. The one
               thing in a conversation a machine can honestly mark.
     end       the encounter is complete

   Repair options are NOT listed in the data: the runner adds them to every
   beat, because a repair that is only available where an author remembered
   to offer it is not a repair kit. */
const DIYALOG=[

 {id:"bilet", tr:"Otogar", en:"Buying a bus ticket", lv:"A2",
  blurb:"A ticket counter. The clerk is brisk and the price is said once.",
  vars:{yer:{pick:[{t:"Bursa",e:"Bursa",dat:"Bursa'ya"},{t:"İzmir",e:"İzmir",dat:"İzmir'e"},
                   {t:"Ankara",e:"Ankara",dat:"Ankara'ya"},{t:"Eskişehir",e:"Eskişehir",dat:"Eskişehir'e"},
                   {t:"Konya",e:"Konya",dat:"Konya'ya"},{t:"Antalya",e:"Antalya",dat:"Antalya'ya"}]},
        fiyat:{price:[80,450]}, donus:{x2:"fiyat"}},
  start:"a",
  beats:{
   a:{say:"Buyurun, nereye?", slow:"Buyurun… nereye gidiyorsunuz?",
      easy:"Nereye gitmek istiyorsunuz?",
      opts:[{en:"a ticket to {yer}, please", tr:"{yer.dat} bir bilet lütfen", to:"b"},
            {en:"is there a bus to {yer}?",  tr:"{yer.dat} otobüs var mı?",  to:"b"}]},
   b:{say:"Tek yön mü, gidiş dönüş mü?", slow:"Tek yön mü… yoksa gidiş dönüş mü?",
      easy:"Sadece gidiş mi?",
      opts:[{en:"one way, please",  tr:"Tek yön lütfen",     to:"c"},
            {en:"return, please",   tr:"Gidiş dönüş lütfen", to:"c2"}]},
   c:{say:"{fiyat}.", slow:"{fiyat}.", want:"fiyat", to:"d"},
   c2:{say:"{donus}.", slow:"{donus}.", want:"donus", to:"d"},
   d:{say:"Nasıl ödeyeceksiniz?", slow:"Kartla mı, nakit mi?",
      easy:"Kart mı, para mı?",
      opts:[{en:"can I pay by card?", tr:"Kartla ödeyebilir miyim?", to:"e"},
            {en:"I'll pay cash",      tr:"Nakit ödeyeceğim",         to:"e"}]},
   e:{say:"Buyurun, biletiniz. İyi yolculuklar.", end:true}}},

 {id:"pazar", tr:"Pazar", en:"A market stall", lv:"A1",
  blurb:"A stallholder who talks fast and adds things up in his head.",
  vars:{urun:{pick:[{t:"domates",e:"tomatoes",abl:"domatesten"},{t:"biber",e:"peppers",abl:"biberden"},
                    {t:"elma",e:"apples",abl:"elmadan"},{t:"üzüm",e:"grapes",abl:"üzümden"},
                    {t:"patates",e:"potatoes",abl:"patatesten"},{t:"soğan",e:"onions",abl:"soğandan"}]},
        kilo:{price:[15,90]}, hepsi:{x2:"kilo"}},
  start:"a",
  beats:{
   a:{say:"Buyurun, ne istersiniz?", slow:"Buyurun… ne alırsınız?",
      easy:"Ne istiyorsunuz?",
      opts:[{en:"how much are the {urun}?",  tr:"{urun} kaç para?",            to:"b"},
            {en:"a kilo of {urun}, please",  tr:"{urun.abl} bir kilo lütfen",  to:"b"}]},
   b:{say:"Kilosu {kilo}.", slow:"Kilosu… {kilo}.", want:"kilo", to:"c"},
   c:{say:"Başka bir şey?", slow:"Başka bir şey ister misiniz?",
      easy:"Başka?",
      opts:[{en:"no, thank you",        tr:"Yok, teşekkürler",  to:"d"},
            {en:"two kilos then",       tr:"İki kilo olsun",    to:"d"}]},
   d:{say:"Hepsi {hepsi}.", slow:"Hepsi… {hepsi}.", want:"hepsi", to:"e"},
   e:{say:"Afiyet olsun.", end:true}}},

 {id:"kafe", tr:"Kafe", en:"Ordering in a café", lv:"A1",
  blurb:"Ordering, being asked how you take it, and paying.",
  vars:{fiyat:{price:[25,140]}},
  start:"a",
  beats:{
   a:{say:"Hoş geldiniz, ne alırsınız?", slow:"Hoş geldiniz… ne içersiniz?",
      easy:"Ne istersiniz?",
      opts:[{en:"a tea, please",          tr:"Bir çay lütfen",          to:"b"},
            {en:"a Turkish coffee, please", tr:"Bir Türk kahvesi lütfen", to:"b"}]},
   b:{say:"Şekerli mi, şekersiz mi?", slow:"Şekerli mi… şekersiz mi?",
      easy:"Şeker koyayım mı?",
      opts:[{en:"without sugar, please", tr:"Şekersiz lütfen",   to:"c"},
            {en:"a little sugar",        tr:"Az şekerli olsun",  to:"c"}]},
   c:{say:"Yanında bir şey ister misiniz?", slow:"Yanında bir şey… ister misiniz?",
      easy:"Başka bir şey?",
      opts:[{en:"no, thank you",   tr:"Yok, teşekkürler",  to:"d"},
            {en:"a water as well", tr:"Bir su da alayım",  to:"d"}]},
   d:{say:"{fiyat}.", slow:"{fiyat}.", want:"fiyat", to:"e"},
   e:{say:"Afiyet olsun.", end:true}}},

 {id:"yol", tr:"Yol tarifi", en:"Asking the way", lv:"A1",
  blurb:"Directions from a stranger, including the one you have to ask twice.",
  vars:{yer:{pick:[{t:"müze",e:"museum",dat:"müzeye"},{t:"postane",e:"post office",dat:"postaneye"},
                   {t:"eczane",e:"pharmacy",dat:"eczaneye"},{t:"otogar",e:"bus station",dat:"otogara"},
                   {t:"hastane",e:"hospital",dat:"hastaneye"}]},
        kac:{pick:[{t:"birinci",e:"first"},{t:"ikinci",e:"second"},{t:"üçüncü",e:"third"}]},
        dk:{num:[3,20]}},
  start:"a",
  beats:{
   a:{say:"Buyurun, yardımcı olabilir miyim?", slow:"Buyurun… yardım edebilir miyim?",
      easy:"Bir şey mi arıyorsunuz?",
      opts:[{en:"excuse me, where is the {yer}?", tr:"Affedersiniz, {yer} nerede?",     to:"b"},
            {en:"how can I get to the {yer}?",    tr:"{yer.dat} nasıl gidebilirim?",    to:"b"}]},
   b:{say:"Düz gidin, {kac} sokaktan sağa dönün.",
      slow:"Düz gidin… {kac} sokaktan… sağa dönün.",
      easy:"Düz gidin, sonra sağa dönün.",
      opts:[{en:"right or left?",        tr:"Sağa mı, sola mı?",    to:"c"},
            {en:"how long does it take?", tr:"Ne kadar sürer?",     to:"d"}]},
   c:{say:"Sağa. {kac} sokaktan sağa.", slow:"Sağa… sağa dönün.",
      opts:[{en:"how long does it take?", tr:"Ne kadar sürer?", to:"d"},
            {en:"thank you very much",    tr:"Çok teşekkür ederim", to:"e"}]},
   d:{say:"Yürüyerek {dk} dakika.", slow:"Yürüyerek… {dk} dakika.", want:"dk", to:"e"},
   e:{say:"Kolay gelsin.", end:true}}},

 {id:"eczane", tr:"Eczane", en:"At the pharmacy", lv:"A2",
  blurb:"Saying what is wrong, how long it has been, and how often to take it.",
  vars:{kez:{num:[2,4]}, gun:{num:[3,10]}},
  start:"a",
  beats:{
   a:{say:"Geçmiş olsun, şikâyetiniz ne?", slow:"Geçmiş olsun… neyiniz var?",
      easy:"Neresi ağrıyor?",
      opts:[{en:"my throat hurts",  tr:"Boğazım ağrıyor", to:"b"},
            {en:"my head hurts",    tr:"Başım ağrıyor",   to:"b"},
            {en:"I have a fever",   tr:"Ateşim var",      to:"b"}]},
   b:{say:"Ne zamandan beri?", slow:"Ne zamandan beri böyle?",
      easy:"Kaç gündür?",
      opts:[{en:"for two days",   tr:"İki gündür",   to:"c"},
            {en:"since yesterday", tr:"Dünden beri", to:"c"}]},
   c:{say:"Bu ilacı günde {kez} kez alın.", slow:"Günde… {kez} kez.",
      want:"kez", to:"d"},
   d:{say:"{gun} gün kullanın, geçmezse doktora gidin.",
      slow:"{gun} gün kullanın.",
      easy:"Kaç gün? {gun} gün.",
      want:"gun", to:"e"},
   e:{say:"Geçmiş olsun.", end:true}}},

 {id:"randevu", tr:"Randevu", en:"Arranging to meet", lv:"A1",
  blurb:"A friend proposing a time. The one where saying no is a real branch.",
  vars:{saat:{time:1}, saat2:{time:1},
        yer:{pick:[{t:"kafe",e:"café",loc:"kafede"},{t:"park",e:"park",loc:"parkta"},
                   {t:"iskele",e:"landing",loc:"iskelede"},{t:"meydan",e:"square",loc:"meydanda"}]}},
  start:"a",
  beats:{
   a:{say:"Yarın buluşalım mı?", slow:"Yarın… buluşalım mı?",
      easy:"Yarın görüşelim mi?",
      opts:[{en:"sure, what time?",        tr:"Olur, saat kaçta?",       to:"b"},
            {en:"I'm not free tomorrow",   tr:"Yarın müsait değilim",    to:"b2"}]},
   b:{say:"{saat}, uygun mu?", slow:"Saat… {saat}. Uygun mu?", want:"saat", to:"c"},
   b2:{say:"Peki, cumartesi {saat2} nasıl?", slow:"Cumartesi… {saat2}.",
       want:"saat2", to:"c"},
   c:{say:"Nerede buluşalım?", slow:"Nerede… buluşalım?",
      easy:"Neresi olsun?",
      opts:[{en:"let's meet at the {yer}", tr:"{yer.loc} buluşalım",      to:"d"},
            {en:"wherever suits you",      tr:"Sana neresi uygunsa",      to:"d"}]},
   d:{say:"Tamam, görüşürüz.", end:true}}}
];
