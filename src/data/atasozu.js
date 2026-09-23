/* Atasözleri ve deyimler — the fixed figurative layer, which is the one
   part of the language a learner can deploy at full speed while their
   productive grammar is still slow. Nothing here is composed at the
   moment of speaking: it is reached for whole, like a chunk, but unlike
   a chunk it carries an argument or a picture.

   WHY THIS IS ANONYMOUS MATERIAL AND THAT MATTERS
   Proverbs and idioms belong to nobody. There is no author to attribute,
   no edition to check a line against, and no copyright to clear — which
   is exactly why this shelf could be built when the Kütüphane one could
   not. See the Kütüphane entry in CLAUDE.md for that argument in full.

   VARIANTS ARE LISTED, NOT CHOSEN BETWEEN
   A proverb is fixed, but "fixed" does not mean there is exactly one
   wording. "İşleyen demir pas tutmaz" and "İşleyen demir ışıldar" are
   both real and a learner will meet either. Where that is true the entry
   carries `alt`, the judge accepts any of them, and the screen shows the
   others after a right answer. Inventing a single official form would be
   a smaller lie than a misquoted author, but it would still be a lie.

   SHAPE — atasözü
     id    permanent, like a unit id. S.ata is keyed "a:<id>"
     t     the saying, as it is said
     en    what it says, close rather than idiomatic
     eq    the English proverb that does the same job, where one exists;
           omitted rather than forced, because most have no clean match
     s     THE PROMPT: a one-line situation the saying answers. The skill
           is knowing WHEN to say it — a proverb produced at the wrong
           moment is worse than silence — so the learner is given the
           moment and produces the saying, never the other way round
     alt   other accepted wordings, all real

   SHAPE — deyim
     id    permanent. S.ata is keyed "d:<id>"
     t     the citation form, uninflected
     en    THE PROMPT: what it means
     lit   what the words say, which is the whole point: an idiom is
           non-compositional, so a learner who knows every word still
           fails. Shown on the reveal as the hook, never as a hint
     ex    one example sentence, [tr, en], Özgün metin — written for this
           course rather than quoted, like every other sentence here

   ids are slugs, not positions. CHUNKS keys by array index and is
   therefore append-only for ever; this bank is keyed by `id`, so it can
   be reordered, regrouped and interleaved freely without re-pointing a
   single saved box. That was worth the extra field. */
const ATASOZU=[
 /* --- patience, effort, and the long way round --- */
 {id:"damlaya",t:"Damlaya damlaya göl olur.",
  en:"Drop by drop, a lake forms.",eq:"Many a little makes a mickle.",
  s:"A friend says ten minutes of study a day is too little to be worth bothering with."},
 {id:"agacyas",t:"Ağaç yaş iken eğilir.",
  en:"A tree is bent while it is green.",
  s:"A parent wonders whether it is worth correcting a small child's habit now or later."},
 {id:"dervis",t:"Sabreden derviş muradına ermiş.",
  en:"The dervish who was patient reached what he wished for.",
  s:"Someone is about to give up just before the thing they have waited months for."},
 {id:"kervan",t:"Kervan yolda düzülür.",
  en:"The caravan is put in order on the road.",
  s:"Someone refuses to start at all because the plan is not finished yet."},
 {id:"demir",t:"İşleyen demir pas tutmaz.",
  en:"Iron that works does not rust.",
  s:"Someone has stopped practising and worries the skill is slipping away.",
  alt:["İşleyen demir ışıldar."]},
 {id:"bugun",t:"Bugünün işini yarına bırakma.",
  en:"Do not leave today's work to tomorrow.",eq:"Never put off till tomorrow what you can do today.",
  s:"You are about to put off something you could perfectly well finish now."},
 {id:"tasima",t:"Taşıma suyla değirmen dönmez.",
  en:"A mill does not turn on carried water.",
  s:"A project is running entirely on borrowed help and clearly cannot last."},

 /* --- haste, anger, and decisions made badly --- */
 {id:"acele",t:"Acele işe şeytan karışır.",
  en:"The devil meddles in hurried work.",eq:"Haste makes waste.",
  s:"A colleague is rushing a job and the mistakes are piling up behind them."},
 {id:"ofke",t:"Öfkeyle kalkan zararla oturur.",
  en:"Whoever rises in anger sits down at a loss.",
  s:"Someone is about to make a decision while they are still furious."},
 {id:"sirke",t:"Keskin sirke küpüne zarar verir.",
  en:"Sharp vinegar damages its own jar.",
  s:"Someone's temper is hurting them more than it hurts anyone else."},
 {id:"karpuz",t:"İki karpuz bir koltuğa sığmaz.",
  en:"Two watermelons do not fit under one arm.",
  s:"Someone is trying to do two demanding things properly at the same time."},
 {id:"pisman",t:"Son pişmanlık fayda etmez.",
  en:"Regret at the end is no use.",
  s:"Someone is regretting, far too late, that they did not prepare."},
 {id:"zarar",t:"Zararın neresinden dönülse kârdır.",
  en:"Turning back from a loss is a profit wherever you do it.",
  s:"Someone hesitates to abandon a losing plan because of what they have already put in."},

 /* --- people, and what they turn out to be --- */
 {id:"dost",t:"Dost kara günde belli olur.",
  en:"A friend is known on a black day.",eq:"A friend in need is a friend indeed.",
  s:"Trouble has arrived and you are finding out who actually stays."},
 {id:"karga",t:"Besle kargayı, oysun gözünü.",
  en:"Feed the crow and it will peck out your eye.",
  s:"Someone you helped for years has just turned on you."},
 {id:"uzum",t:"Üzüm üzüme baka baka kararır.",
  en:"Grape darkens by looking at grape.",
  s:"Someone has quietly picked up the habits of the crowd they spend their time with."},
 {id:"suru",t:"Sürüden ayrılanı kurt kapar.",
  en:"The wolf takes the one that leaves the flock.",
  s:"Someone is about to go off alone against everyone's advice."},
 {id:"komsu",t:"Komşu komşunun külüne muhtaçtır.",
  en:"A neighbour is in need of his neighbour's ashes.",
  s:"Someone insists they need nothing at all from the people around them."},
 {id:"birelin",t:"Bir elin nesi var, iki elin sesi var.",
  en:"What has one hand got? Two hands have a sound.",eq:"Two heads are better than one.",
  s:"Someone insists on finishing the whole job by themselves."},
 {id:"elelden",t:"El elden üstündür.",
  en:"There is always a hand above a hand.",
  s:"Someone is convinced they are simply the best there is at what they do."},
 {id:"balik",t:"Balık baştan kokar.",
  en:"A fish stinks from the head.",
  s:"A team is in a mess and the problem is plainly the person running it."},
 {id:"kahve",t:"Bir fincan kahvenin kırk yıl hatırı vardır.",
  en:"A cup of coffee is remembered for forty years.",
  s:"You are reminding someone that a small kindness is not forgotten."},

 /* --- truth, lies, and what comes out anyway --- */
 {id:"ates",t:"Ateş olmayan yerden duman çıkmaz.",
  en:"Smoke does not rise where there is no fire.",eq:"There's no smoke without fire.",
  s:"A rumour keeps going around and you suspect there is something behind it."},
 {id:"yalanci",t:"Yalancının mumu yatsıya kadar yanar.",
  en:"The liar's candle burns only until the night prayer.",
  s:"Someone has been lying for weeks and it is starting to come apart."},
 {id:"minare",t:"Minareyi çalan kılıfını hazırlar.",
  en:"Whoever steals the minaret prepares its cover first.",
  s:"Someone who planned something dishonest already had their excuse ready."},
 {id:"dogru",t:"Doğru söyleyeni dokuz köyden kovarlar.",
  en:"They drive the one who tells the truth out of nine villages.",
  s:"Someone told an unwelcome truth and is now thoroughly unpopular for it."},
 {id:"koy",t:"Görünen köy kılavuz istemez.",
  en:"A village you can see needs no guide.",
  s:"The outcome is already obvious and someone is still asking to be convinced."},
 {id:"calma",t:"Çalma elin kapısını, çalarlar kapını.",
  en:"Do not knock at another's door, or they will knock at yours.",
  s:"Someone treats other people badly and is surprised when it comes back round."},
 {id:"ekersen",t:"Ne ekersen onu biçersin.",
  en:"You reap whatever you sow.",eq:"As you sow, so shall you reap.",
  s:"Someone is startled by the consequences of how they treated people."},

 /* --- risk, caution, and learning the hard way --- */
 {id:"testi",t:"Su testisi su yolunda kırılır.",
  en:"The water jug breaks on the way to the water.",
  s:"Someone points out that a risk taken every day will cost you eventually."},
 {id:"sutten",t:"Sütten ağzı yanan yoğurdu üfleyerek yer.",
  en:"Whoever burns their mouth on milk blows on yoghurt.",eq:"Once bitten, twice shy.",
  s:"Someone burned once is now being over-careful about everything that resembles it."},
 {id:"musibet",t:"Bir musibet bin nasihatten iyidir.",
  en:"One calamity is better than a thousand pieces of advice.",
  s:"Someone has finally learned from one bad experience what nobody could tell them."},
 {id:"denize",t:"Denize düşen yılana sarılır.",
  en:"Whoever falls in the sea clings to a snake.",eq:"A drowning man will clutch at a straw.",
  s:"Someone desperate is accepting help from a source they would never normally trust."},
 {id:"acayi",t:"Aç ayı oynamaz.",
  en:"A hungry bear does not dance.",
  s:"Someone expects good work from people who have not been fed or paid."},

 /* --- getting what you want out of people and things --- */
 {id:"tatlidil",t:"Tatlı dil yılanı deliğinden çıkarır.",
  en:"A sweet tongue draws the snake out of its hole.",
  s:"Someone is getting nowhere by shouting at an official."},
 {id:"gul",t:"Gülü seven dikenine katlanır.",
  en:"Whoever loves the rose puts up with its thorn.",
  s:"Someone wants the good part of a thing without any of what it costs."},
 {id:"alet",t:"Alet işler el övünür.",
  en:"The tool does the work and the hand takes the credit.",
  s:"Someone is taking all the credit for what the equipment did."},
 {id:"saman",t:"Sakla samanı, gelir zamanı.",
  en:"Keep the straw; its time will come.",
  s:"You are about to throw out something old that still works perfectly well."},
 {id:"yorgan",t:"Ayağını yorganına göre uzat.",
  en:"Stretch your leg according to your quilt.",eq:"Cut your coat according to your cloth.",
  s:"Someone is about to buy a car they clearly cannot afford."},
 {id:"vakit",t:"Vakit nakittir.",
  en:"Time is money.",eq:"Time is money.",
  s:"Someone is spending hours on nothing when those hours could be earning."}
];

const DEYIM=[
 /* --- the head, and thinking --- */
 {id:"kafapatlat",t:"kafa patlatmak",en:"to rack your brains over something",
  lit:"to burst a head",
  ex:["Bu soru için bütün gece kafa patlattım.","I racked my brains over this question all night."]},
 {id:"kafayitak",t:"kafayı takmak",en:"to become fixated on something",
  lit:"to fasten one's head onto it",
  ex:["Bu fikre kafayı taktı, başka bir şey konuşmuyor.","He has become fixated on this idea and talks about nothing else."]},
 {id:"akilbasina",t:"aklı başına gelmek",en:"to come to your senses",
  lit:"for one's mind to come to one's head",
  ex:["Faturayı görünce aklı başına geldi.","When she saw the bill she came to her senses."]},
 {id:"akilvermek",t:"akıl vermek",en:"to give someone advice they did not ask for",
  lit:"to give mind",
  ex:["Kimse sormadan akıl vermeyi çok seviyor.","He loves giving advice before anyone asks for it."]},
 {id:"kafadengi",t:"kafa dengi",en:"a kindred spirit, someone on your wavelength",
  lit:"head-equal",
  ex:["Yıllar sonra kafa dengi birini buldum.","After years I found someone on my wavelength."]},

 /* --- the eye, and noticing --- */
 {id:"gozyummak",t:"göz yummak",en:"to turn a blind eye to something",
  lit:"to close one's eye",
  ex:["Küçük hatalara göz yumdu.","She turned a blind eye to the small mistakes."]},
 {id:"gozdenkac",t:"gözden kaçmak",en:"to escape notice, to be overlooked",
  lit:"to slip from the eye",
  ex:["Bir iki yazım hatası gözden kaçmış.","One or two spelling mistakes were overlooked."]},
 {id:"gozdendus",t:"gözden düşmek",en:"to fall out of favour",
  lit:"to fall from the eye",
  ex:["O toplantıdan sonra gözden düştü.","After that meeting he fell out of favour."]},
 {id:"gozkulak",t:"göz kulak olmak",en:"to keep an eye on someone or something",
  lit:"to be eye and ear",
  ex:["Ben yokken kediye göz kulak olur musun?","Would you keep an eye on the cat while I am away?"]},
 {id:"gozukalmak",t:"gözü kalmak",en:"to still want something you did not get",
  lit:"for one's eye to remain",
  ex:["Vitrindeki o cekette gözüm kaldı.","I still have my eye on that jacket in the window."]},
 {id:"gozutut",t:"gözü tutmak",en:"to like the look of someone or something",
  lit:"for the eye to hold it",
  ex:["Evi gezdik ama gözümüz tutmadı.","We looked round the house but did not like the look of it."]},
 {id:"gozkorkut",t:"gözünü korkutmak",en:"to intimidate someone, to put the wind up them",
  lit:"to frighten someone's eye",
  ex:["İlk sınav hepimizin gözünü korkuttu.","The first exam put the wind up all of us."]},
 {id:"gozgore",t:"göz göre göre",en:"blatantly, in plain sight",
  lit:"eye seeing seeing",
  ex:["Göz göre göre yanlış yola saptık.","We took the wrong road in plain sight of everyone."]},

 /* --- the ear, and listening --- */
 {id:"kulakkabart",t:"kulak kabartmak",en:"to prick up your ears, to start listening in",
  lit:"to puff up an ear",
  ex:["Adımı duyunca kulak kabarttım.","When I heard my name I pricked up my ears."]},
 {id:"kulakmisafir",t:"kulak misafiri olmak",en:"to overhear something by accident",
  lit:"to be an ear-guest",
  ex:["Otobüste konuşmalarına kulak misafiri oldum.","I overheard their conversation on the bus."]},
 {id:"cankulagi",t:"can kulağıyla dinlemek",en:"to listen with your whole attention",
  lit:"to listen with the ear of the soul",
  ex:["Çocuklar masalı can kulağıyla dinledi.","The children listened to the story with rapt attention."]},
 {id:"kulagacalin",t:"kulağına çalınmak",en:"to catch wind of something",
  lit:"for it to be struck against one's ear",
  ex:["Taşınacakları kulağıma çalındı.","I caught wind that they are going to move."]},

 /* --- the mouth, and what gets said --- */
 {id:"baklayicik",t:"ağzından baklayı çıkarmak",en:"to finally blurt out what you have been holding back",
  lit:"to get the broad bean out of one's mouth",
  ex:["Tartışmanın sonunda ağzından baklayı çıkardı.","At the end of the argument he finally blurted it out."]},
 {id:"agzibicak",t:"ağzını bıçak açmamak",en:"to be too upset to say a word",
  lit:"for a knife not to open one's mouth",
  ex:["Haberi duyduktan sonra ağzını bıçak açmadı.","After hearing the news she could not say a word."]},
 {id:"cenesidusuk",t:"çenesi düşük",en:"someone who talks far too much",
  lit:"slack-jawed",
  ex:["Çenesi düşük biri, iki saat susmadı.","He is a terrible chatterbox — he did not stop for two hours."]},
 {id:"agzivardili",t:"ağzı var dili yok",en:"meek, someone who never speaks up",
  lit:"has a mouth, has no tongue",
  ex:["Ağzı var dili yok, hiç itiraz etmez.","She never speaks up and never objects to anything."]},
 {id:"lafatmak",t:"laf atmak",en:"to call out remarks at someone in the street",
  lit:"to throw words",
  ex:["Sokakta laf atanlara hiç aldırmadı.","She paid no attention to the men calling out in the street."]},
 {id:"dilidusmek",t:"dile düşmek",en:"to become the subject of gossip",
  lit:"to fall onto tongues",
  ex:["Bir hafta içinde dile düştüler.","Within a week people were talking about them."]},

 /* --- the hand, the foot, and getting on with it --- */
 {id:"kollarisiva",t:"kolları sıvamak",en:"to roll up your sleeves and get started",
  lit:"to roll up the sleeves",
  ex:["Herkes kolları sıvadı ve ev iki saatte toplandı.","Everyone rolled up their sleeves and the house was tidy in two hours."]},
 {id:"elatmak",t:"el atmak",en:"to take something on, to step in and deal with it",
  lit:"to throw a hand",
  ex:["Kimse çözmeyince işe kendisi el attı.","When nobody else solved it she took the job on herself."]},
 {id:"elibos",t:"eli boş dönmek",en:"to come back empty-handed",
  lit:"to return with an empty hand",
  ex:["Bütün gün aradık ama eli boş döndük.","We searched all day but came back empty-handed."]},
 {id:"elikolubagli",t:"eli kolu bağlı kalmak",en:"to be left unable to do anything",
  lit:"for one's hand and arm to stay tied",
  ex:["Belge gelmeyince eli kolu bağlı kaldı.","With the document missing there was nothing he could do."]},
 {id:"ayakuydur",t:"ayak uydurmak",en:"to keep up with something, to fall into step",
  lit:"to fit one's foot to it",
  ex:["Yeni sisteme ayak uydurmak iki ay sürdü.","It took two months to keep up with the new system."]},
 {id:"ayakdenk",t:"ayağını denk almak",en:"to watch your step, to be on your guard",
  lit:"to take one's foot level",
  ex:["Orada çalışırken ayağını denk al.","Watch your step while you are working there."]},
 {id:"baltatas",t:"baltayı taşa vurmak",en:"to put your foot in it, to say the wrong thing",
  lit:"to strike the axe on the stone",
  ex:["Sormakla baltayı taşa vurdum.","I really put my foot in it by asking."]},

 /* --- the nose, the face, and how you carry yourself --- */
 {id:"burunkivir",t:"burun kıvırmak",en:"to turn your nose up at something",
  lit:"to curl the nose",
  ex:["Yemeğe burun kıvırdı.","He turned his nose up at the food."]},
 {id:"burnunusok",t:"burnunu sokmak",en:"to poke your nose into something",
  lit:"to stick one's nose in",
  ex:["Her işe burnunu sokuyor.","She pokes her nose into everything."]},
 {id:"burnundangetir",t:"burnundan getirmek",en:"to make someone pay dearly for something",
  lit:"to bring it out through the nose",
  ex:["Bu şakayı burnundan getirecekler.","They will make him pay dearly for this joke."]},
 {id:"yuzukizar",t:"yüzü kızarmak",en:"to blush with embarrassment",
  lit:"for the face to redden",
  ex:["Adını duyunca yüzü kızardı.","She blushed when she heard his name."]},
 {id:"yuzunevur",t:"yüzüne vurmak",en:"to throw something back in someone's face",
  lit:"to strike it on the face",
  ex:["Yardım ettiğini sürekli yüzüne vuruyor.","He keeps throwing it in her face that he helped."]},
 {id:"yuzvermek",t:"yüz vermek",en:"to indulge someone, to give them encouragement",
  lit:"to give face",
  ex:["Ona fazla yüz verme, sonra kurtulamazsın.","Do not indulge him too much or you will never be rid of him."]},
 {id:"agirbasli",t:"ağır başlı",en:"dignified and level-headed",
  lit:"heavy-headed",
  ex:["Ağır başlı bir çocuk, hiç bağırmaz.","He is a level-headed child and never shouts."]},
 {id:"havaatmak",t:"hava atmak",en:"to show off",
  lit:"to throw air",
  ex:["Yeni telefonuyla hava atıyor.","He is showing off with his new phone."]},

 /* --- states you end up in --- */
 {id:"dokuzdogur",t:"dokuz doğurmak",en:"to be beside yourself waiting for news",
  lit:"to give birth nine times",
  ex:["Sen gelene kadar dokuz doğurdum.","I was beside myself until you got here."]},
 {id:"kanter",t:"kan ter içinde kalmak",en:"to end up drenched in sweat",
  lit:"to be left inside blood and sweat",
  ex:["Merdivenleri koşunca kan ter içinde kaldım.","After running up the stairs I was drenched in sweat."]},
 {id:"cilekencik",t:"çileden çıkmak",en:"to lose your patience completely",
  lit:"to come out of the ascetic's trial",
  ex:["Üçüncü gecikmede çileden çıktı.","At the third delay he lost his patience completely."]},
 {id:"icirahat",t:"içi rahat etmek",en:"to be set at ease about something",
  lit:"for one's inside to become comfortable",
  ex:["Vardığını duyunca içim rahat etti.","Hearing that she arrived set my mind at ease."]},
 {id:"tadikac",t:"tadı kaçmak",en:"for the pleasure to go out of something",
  lit:"for the taste to escape",
  ex:["Tartışınca akşamın tadı kaçtı.","Once they argued the pleasure went out of the evening."]},
 {id:"elikulaginda",t:"eli kulağında",en:"about to happen at any moment",
  lit:"its hand is at its ear",
  ex:["Sonuçların açıklanması eli kulağında.","The results are about to be announced at any moment."]},
 {id:"bosvermek",t:"boş vermek",en:"to not bother about something, to let it go",
  lit:"to give empty",
  ex:["Boş ver, yarın hallederiz.","Never mind — we will sort it out tomorrow."]},
 {id:"pireyorgan",t:"pire için yorgan yakmak",en:"to cause huge damage over something trivial",
  lit:"to burn the quilt because of a flea",
  ex:["Bir yazım hatası için siteyi kapatmak, pire için yorgan yakmak.","Taking the site down over one typo is burning the quilt for a flea."]},
 {id:"elustunde",t:"el üstünde tutmak",en:"to treat someone with great care and respect",
  lit:"to hold on top of hands",
  ex:["Misafirlerini el üstünde tutar.","She treats her guests with great care."]},
 {id:"basinagelmek",t:"başına gelmek",en:"for something to happen to you",
  lit:"to come onto one's head",
  ex:["Aynı şey geçen yıl benim de başıma geldi.","The same thing happened to me last year too."]},
 {id:"ikiayak",t:"iki ayağını bir pabuca sokmak",en:"to rush someone mercilessly",
  lit:"to put someone's two feet into one shoe",
  ex:["Müdür hepimizin iki ayağını bir pabuca soktu.","The manager rushed every one of us mercilessly."]}
];
