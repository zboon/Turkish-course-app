/* Drill lexicon for the generative drills. Every entry carries what the
   morphology engine cannot guess:

     p     "n" noun · "v" verb · "a" adjective
     soft  final p/ç/t/k softens before a vowel  (kitap → kitabı)
     drop  the last vowel drops before a vowel   (şehir → şehri)
     aor   verb takes -Ir where -Ar is expected  (gelmek → gelir)
     irr   forms the engine must not derive      (su → suyu)
     e     English [base, -ing, past, he-form] — no more derivable
           in English than the Turkish is in Turkish
     obj   nouns this verb may take as an object, dat/loc likewise.
           Without them the generator writes "I am drinking the school".

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
 {t:"yol",lp:"on",en:"road",p:"n"},
 {t:"iş",en:"work",p:"n"},
 {t:"gün",en:"day",p:"n"},
 {t:"yıl",en:"year",p:"n"},
 {t:"şehir",lp:"in",en:"city",p:"n",drop:1},
 {t:"burun",en:"nose",p:"n",drop:1},
 {t:"isim",en:"name",p:"n",drop:1},
 {t:"okul",en:"school",p:"n"},
 {t:"masa",lp:"at",en:"table",p:"n"},
 {t:"pencere",en:"window",p:"n"},
 {t:"öğrenci",en:"student",p:"n"},
 {t:"öğretmen",en:"teacher",p:"n"},
 {t:"arkadaş",en:"friend",p:"n"},
 {t:"anne",en:"mother",p:"n"},
 {t:"baba",en:"father",p:"n"},
 {t:"para",en:"money",p:"n"},
 {t:"çay",en:"tea",p:"n"},
 {t:"kahve",en:"coffee",p:"n"},
 {t:"sokak",lp:"in",en:"street",p:"n",soft:1},
 {t:"market",lp:"at",en:"shop",p:"n"},
 {t:"otobüs",en:"bus",p:"n"},
 {t:"uçak",en:"plane",p:"n",soft:1},
 {t:"deniz",lp:"at",en:"sea",p:"n"},
 {t:"kedi",en:"cat",p:"n"},
 {t:"köpek",en:"dog",p:"n",soft:1},
 {t:"kuş",en:"bird",p:"n"},
 {t:"kalem",en:"pen",p:"n"},
 {t:"telefon",en:"telephone",p:"n"},
 {t:"zaman",en:"time",p:"n"},
 {t:"saat",en:"time, hour",p:"n",front:1},   /* saati, saatte */
 {t:"hafta",en:"week",p:"n"},
 {t:"akşam",en:"evening",p:"n"},
 {t:"gece",en:"night",p:"n"},
 {t:"sabah",en:"morning",p:"n"},
 {t:"renk",en:"colour",p:"n",soft:1},
 {t:"kalp",en:"heart",p:"n",soft:1,front:1},   /* Arabic loan: kalbi, kalpte */
 {t:"top",en:"ball",p:"n"},
 {t:"su",en:"water",p:"n",irr:{acc:"suyu",dat:"suya",gen:"suyun",p1:"suyum",p3:"suyu"}},

 /* --- verbs --- */
 {t:"gelmek",en:"to come",p:"v",aor:1,e:["come","coming","came","comes"],prep:"to",dat:["ev","okul","market","şehir"]},
 {t:"gitmek",en:"to go",p:"v",soft:1,e:["go","going","went","goes"],prep:"to",dat:["ev","okul","market","şehir","deniz","sokak"]},
 {t:"almak",en:"to take, to buy",p:"v",aor:1,e:["buy","buying","bought","buys"],obj:["kitap","ekmek","araba","kalem","telefon","çay"]},
 {t:"vermek",needsObj:1,en:"to give",p:"v",aor:1,e:["give","giving","gave","gives"],obj:["para","kitap","kalem","su","çay"]},
 {t:"görmek",stative:1,en:"to see",p:"v",aor:1,e:["see","seeing","saw","sees"],obj:["ev","araba","deniz","kedi","köpek","kuş","arkadaş","çocuk"]},
 {t:"bilmek",stative:1,en:"to know",p:"v",aor:1,e:["know","knowing","knew","knows"],obj:["isim","yol","şehir"]},
 {t:"bulmak",en:"to find",p:"v",aor:1,e:["find","finding","found","finds"],obj:["kitap","kalem","para","yol","ev"]},
 {t:"kalmak",en:"to stay",p:"v",aor:1,e:["stay","staying","stayed","stays"],loc:["ev","şehir","okul"]},
 {t:"olmak",en:"to be, to become",p:"v",aor:1,e:["become","becoming","became","becomes"]},
 {t:"yapmak",needsObj:1,en:"to do, to make",p:"v",e:["make","making","made","makes"],obj:["iş","ekmek","kahve","çay"]},
 {t:"etmek",en:"to do (with a noun)",p:"v",soft:1,e:["do","doing","did","does"],aux:1},
 {t:"içmek",en:"to drink",p:"v",e:["drink","drinking","drank","drinks"],obj:["çay","kahve","su"]},
 {t:"yemek",en:"to eat",p:"v",irr:{prog:"yi",fut:"yiyecek"},e:["eat","eating","ate","eats"],obj:["ekmek"]},
 {t:"demek",en:"to say",p:"v",irr:{prog:"di",fut:"diyecek"},e:["say","saying","said","says"],aux:1},
 {t:"okumak",en:"to read",p:"v",e:["read","reading","read","reads"],obj:["kitap"],loc:["ev","okul"]},
 {t:"yazmak",en:"to write",p:"v",e:["write","writing","wrote","writes"],obj:["kitap","isim"]},
 {t:"çalışmak",en:"to work, to study",p:"v",e:["work","working","worked","works"],loc:["ev","okul","market","şehir"]},
 {t:"konuşmak",en:"to speak",p:"v",e:["speak","speaking","spoke","speaks"]},
 {t:"anlamak",stative:1,en:"to understand",p:"v",e:["understand","understanding","understood","understands"],obj:["kitap","isim"]},
 {t:"beklemek",en:"to wait",p:"v",e:["wait","waiting","waited","waits"],obj:["otobüs","arkadaş","öğretmen"]},
 {t:"başlamak",en:"to begin",p:"v",e:["begin","beginning","began","begins"],dat:["iş","kitap"]},
 {t:"istemek",needsObj:1,stative:1,en:"to want",p:"v",e:["want","wanting","wanted","wants"],obj:["çay","kahve","su","para","ekmek"]},
 {t:"sevmek",needsObj:1,stative:1,en:"to love, to like",p:"v",e:["like","liking","liked","likes"],obj:["çay","kahve","kedi","köpek","deniz","kitap","anne","baba","arkadaş"]},
 {t:"bakmak",en:"to look at",p:"v",e:["look","looking","looked","looks"],prep:"at",dat:["kitap","pencere","deniz","telefon"]},
 {t:"açmak",en:"to open",p:"v",e:["open","opening","opened","opens"],obj:["kapı","pencere","kitap","göz"]},
 {t:"uyumak",en:"to sleep",p:"v",e:["sleep","sleeping","slept","sleeps"],loc:["ev"]},
 {t:"kalkmak",en:"to get up",p:"v",e:["get up","getting up","got up","gets up"]},
 {t:"oturmak",en:"to sit",p:"v",e:["sit","sitting","sat","sits"],loc:["ev","masa","sokak"]},
 {t:"yürümek",en:"to walk",p:"v",e:["walk","walking","walked","walks"],loc:["sokak","yol","deniz"]},
 {t:"sormak",en:"to ask",p:"v",e:["ask","asking","asked","asks"],obj:["isim","saat"]},
 {t:"unutmak",en:"to forget",p:"v",e:["forget","forgetting","forgot","forgets"],obj:["isim","kitap","telefon","para"]},
 {t:"öğrenmek",en:"to learn",p:"v",e:["learn","learning","learned","learns"],obj:["isim","yol"]},
 {t:"getirmek",en:"to bring",p:"v",e:["bring","bringing","brought","brings"],obj:["çay","kitap","su","ekmek"]},
 {t:"satmak",en:"to sell",p:"v",e:["sell","selling","sold","sells"],obj:["araba","ev","kitap","telefon"]},

 /* --- adjectives --- */
 {t:"büyük",en:"big",p:"a",n:["ev","araba","şehir","okul","deniz","köpek","masa","pencere"]},
 {t:"küçük",en:"small",p:"a",n:["ev","araba","kedi","kuş","çocuk","masa","okul"]},
 {t:"güzel",en:"beautiful, nice",p:"a",n:["ev","araba","şehir","gün","kitap","deniz","hafta"]},
 {t:"yeni",en:"new",p:"a",n:["ev","araba","kitap","telefon","kalem","okul","yol"]},
 {t:"eski",en:"old",p:"a",n:["ev","araba","kitap","telefon","şehir","okul"]},
 {t:"uzun",en:"long, tall",p:"a",n:["yol","gün","hafta","sokak","masa"]},
 {t:"kısa",en:"short",p:"a",n:["yol","gün","hafta","kitap","sokak"]},
 {t:"pahalı",en:"expensive",p:"a",n:["araba","ev","kitap","telefon","kahve","otobüs"]},
 {t:"ucuz",en:"cheap",p:"a",n:["araba","kitap","telefon","kahve","çay","ekmek","otobüs"]},
 {t:"sıcak",en:"hot",p:"a",n:["çay","kahve","su","gün","ekmek","sabah"]},
 {t:"soğuk",en:"cold",p:"a",n:["çay","kahve","su","gün","akşam","gece","sabah"]},
 {t:"zor",en:"difficult",p:"a",n:["iş","kitap","yol","gün","hafta"]},
 {t:"kolay",en:"easy",p:"a",n:["iş","kitap","yol"]}
];
