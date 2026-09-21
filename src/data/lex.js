/* Drill lexicon for the generative drills. Every entry carries what the
   morphology engine cannot guess:

     p     "n" noun · "v" verb · "a" adjective
     soft  final p/ç/t/k softens before a vowel  (kitap → kitabı)
     drop  the last vowel drops before a vowel   (şehir → şehri)
     aor   verb takes -Ir where -Ar is expected  (gelmek → gelir)
     irr   forms the engine must not derive      (su → suyu)

   Only vetted stems belong here: the engine will happily generate
   confident, wrong Turkish from an unflagged word, and a drill that
   teaches a wrong form is worse than no drill. */
const LEX=[
 /* --- nouns --- */
 {t:"kitap",en:"book",p:"n",soft:1},
 {t:"kapı",en:"door",p:"n"},
 {t:"ev",en:"house",p:"n"},
 {t:"araba",en:"car",p:"n"},
 {t:"çocuk",en:"child",p:"n",soft:1},
 {t:"ekmek",en:"bread",p:"n",soft:1},
 {t:"göz",en:"eye",p:"n"},
 {t:"el",en:"hand",p:"n"},
 {t:"yol",en:"road",p:"n"},
 {t:"iş",en:"work",p:"n"},
 {t:"gün",en:"day",p:"n"},
 {t:"yıl",en:"year",p:"n"},
 {t:"şehir",en:"city",p:"n",drop:1},
 {t:"burun",en:"nose",p:"n",drop:1},
 {t:"isim",en:"name",p:"n",drop:1},
 {t:"okul",en:"school",p:"n"},
 {t:"masa",en:"table",p:"n"},
 {t:"pencere",en:"window",p:"n"},
 {t:"öğrenci",en:"student",p:"n"},
 {t:"öğretmen",en:"teacher",p:"n"},
 {t:"arkadaş",en:"friend",p:"n"},
 {t:"anne",en:"mother",p:"n"},
 {t:"baba",en:"father",p:"n"},
 {t:"para",en:"money",p:"n"},
 {t:"çay",en:"tea",p:"n"},
 {t:"kahve",en:"coffee",p:"n"},
 {t:"sokak",en:"street",p:"n",soft:1},
 {t:"market",en:"shop",p:"n"},
 {t:"otobüs",en:"bus",p:"n"},
 {t:"uçak",en:"plane",p:"n",soft:1},
 {t:"deniz",en:"sea",p:"n"},
 {t:"kedi",en:"cat",p:"n"},
 {t:"köpek",en:"dog",p:"n",soft:1},
 {t:"kuş",en:"bird",p:"n"},
 {t:"kalem",en:"pen",p:"n"},
 {t:"telefon",en:"telephone",p:"n"},
 {t:"zaman",en:"time",p:"n"},
 {t:"saat",en:"hour, clock",p:"n",front:1},   /* saati, saatte */
 {t:"hafta",en:"week",p:"n"},
 {t:"akşam",en:"evening",p:"n"},
 {t:"sabah",en:"morning",p:"n"},
 {t:"renk",en:"colour",p:"n",soft:1},
 {t:"kalp",en:"heart",p:"n",soft:1,front:1},   /* Arabic loan: kalbi, kalpte */
 {t:"top",en:"ball",p:"n"},
 {t:"su",en:"water",p:"n",irr:{acc:"suyu",dat:"suya",gen:"suyun",p1:"suyum",p3:"suyu"}},

 /* --- verbs --- */
 {t:"gelmek",en:"to come",p:"v",aor:1},
 {t:"gitmek",en:"to go",p:"v",soft:1},
 {t:"almak",en:"to take",p:"v",aor:1},
 {t:"vermek",en:"to give",p:"v",aor:1},
 {t:"görmek",en:"to see",p:"v",aor:1},
 {t:"bilmek",en:"to know",p:"v",aor:1},
 {t:"bulmak",en:"to find",p:"v",aor:1},
 {t:"kalmak",en:"to stay",p:"v",aor:1},
 {t:"olmak",en:"to be, to become",p:"v",aor:1},
 {t:"yapmak",en:"to do, to make",p:"v"},
 {t:"etmek",en:"to do (with a noun)",p:"v",soft:1},
 {t:"içmek",en:"to drink",p:"v"},
 {t:"yemek",en:"to eat",p:"v",irr:{prog:"yi",fut:"yiyecek"}},
 {t:"demek",en:"to say",p:"v",irr:{prog:"di",fut:"diyecek"}},
 {t:"okumak",en:"to read",p:"v"},
 {t:"yazmak",en:"to write",p:"v"},
 {t:"çalışmak",en:"to work, to study",p:"v"},
 {t:"konuşmak",en:"to speak",p:"v"},
 {t:"anlamak",en:"to understand",p:"v"},
 {t:"beklemek",en:"to wait",p:"v"},
 {t:"başlamak",en:"to begin",p:"v"},
 {t:"istemek",en:"to want",p:"v"},
 {t:"sevmek",en:"to love",p:"v"},
 {t:"bakmak",en:"to look",p:"v"},
 {t:"açmak",en:"to open",p:"v"},
 {t:"uyumak",en:"to sleep",p:"v"},
 {t:"kalkmak",en:"to get up",p:"v"},
 {t:"oturmak",en:"to sit",p:"v"},
 {t:"yürümek",en:"to walk",p:"v"},
 {t:"sormak",en:"to ask",p:"v"},
 {t:"unutmak",en:"to forget",p:"v"},
 {t:"öğrenmek",en:"to learn",p:"v"},
 {t:"getirmek",en:"to bring",p:"v"},
 {t:"satmak",en:"to sell",p:"v"},

 /* --- adjectives --- */
 {t:"büyük",en:"big",p:"a"},
 {t:"küçük",en:"small",p:"a"},
 {t:"güzel",en:"beautiful",p:"a"},
 {t:"yeni",en:"new",p:"a"},
 {t:"eski",en:"old",p:"a"},
 {t:"uzun",en:"long, tall",p:"a"},
 {t:"kısa",en:"short",p:"a"},
 {t:"pahalı",en:"expensive",p:"a"},
 {t:"ucuz",en:"cheap",p:"a"},
 {t:"sıcak",en:"hot",p:"a"},
 {t:"soğuk",en:"cold",p:"a"},
 {t:"zor",en:"difficult",p:"a"},
 {t:"kolay",en:"easy",p:"a"}
];
