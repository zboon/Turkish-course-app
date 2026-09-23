/* Konuşurken — how it is said. The units teach written Turkish, which is
   right for a reading course, and it left the spoken language to C1
   unit 9, forty-eight units in: a learner would hear gidicem in their
   first week and meet it on paper a year later. These notes sit under a
   unit's grammar from A1, for recognition — you hear these long before
   you need to say them.

   SHAPE. Keyed by unit id; each note is
     w   the written form, as the unit teaches it
     s   how it is said
     n   one or two plain sentences: what changes, and when
     r   "herkes" — said to anyone · "samimi" — between friends
     re  set when s is only a respelling of w (gidicem for gideceğim),
         so the answer judge must accept it: validate.js runs every one
         through spokenToward() and fails if the two disagree.

   Kept to what is said all over Turkey and in ordinary Istanbul speech.
   Regional forms stay in C2 unit 7, where they are the subject. */
const SPOKEN={
 a1u1:[
  {w:"Nasılsın?",s:"Naber?",r:"samimi",n:"From ne haber, what news. The everyday greeting between friends; the usual answer is İyidir, sen?"},
  {w:"Merhaba.",s:"Selam.",r:"samimi",n:"The relaxed hello. Merhaba works with anyone; selam is for people you know or people your own age."},
  {w:"Teşekkür ederim.",s:"Sağ ol.",r:"herkes",n:"The short thanks you will hear most, to a shopkeeper or a friend alike. Teşekkürler sits between the two."}],
 a1u2:[
  {w:"Bu bir kitap.",s:"Bu bi kitap.",r:"herkes",re:1,n:"Unstressed bir, meaning a, loses its r in almost everyone's speech. In writing it keeps it."},
  {w:"Öğretmen, değil mi?",s:"Öğretmen, di mi?",r:"samimi",re:1,n:"değil mi at the end is a tag, like isn't he? At speed it shrinks to di mi."}],
 a1u3:[
  {w:"Benim adım Zeynep.",s:"Adım Zeynep.",r:"herkes",n:"The ending already says my, so the pronoun is dropped unless it is stressed. Benim adım Zeynep sounds like a correction."},
  {w:"ağabey",s:"abi",r:"herkes",n:"Nobody says ağabey aloud. Abi and abla are also how you address a man or woman a little older than you, a shopkeeper included."}],
 a1u4:[
  {w:"Evet, ekmek var.",s:"Var.",r:"herkes",n:"The answer to Ekmek var mı? is just Var, or Yok. Repeating the noun is what a textbook does."},
  {w:"Hayır, istemiyorum.",s:"Yok, istemem.",r:"herkes",n:"Yok is the everyday no when turning something down: Çay? Yok, sağ ol. Hayır is firmer."}],
 a1u5:[
  {w:"Ne yapıyorsun?",s:"Napıyorsun?",r:"herkes",re:1,n:"Ne yapıyorsun runs together into one word. You will hear it far more often than the full form."},
  {w:"Geliyorum.",s:"Geliyom.",r:"samimi",re:1,n:"Casual speech drops the r of -yor: geliyom, geliyosun, geliyo. Common between friends, and in their messages; not in writing to a stranger."}],
 a1u6:[
  {w:"Bir dakika.",s:"Bi dakka.",r:"herkes",re:1,n:"Hang on a moment. Dakika is dakka in nearly everyone's mouth."},
  {w:"Saat üçte buluşalım mı?",s:"Üçte buluşalım mı?",r:"herkes",n:"Saat is usually left out when it is obvious that an hour is meant."}],
 a1u7:[
  {w:"bir şey",s:"bişey",r:"herkes",re:1,n:"Something is one word in speech: bişey. Hiçbir şey, nothing, likewise becomes hiçbişey."}],
 a1u8:[
  {w:"Buyurun.",s:"Buyrun.",r:"herkes",re:1,n:"Said all day by anyone serving you, and almost always with the middle vowel gone."},
  {w:"Bunu alabilir miyim?",s:"Bundan bi tane.",r:"herkes",n:"At a stall you point and say bundan bi tane, one of these, rather than a whole sentence."}],
 a1u10:[
  {w:"burada · şurada · orada",s:"burda · şurda · orda",r:"herkes",re:1,n:"The middle a goes in speech, and very often in messages too: Ben burdayım, I'm here."},
  {w:"Nerede?",s:"Nerde?",r:"herkes",re:1,n:"The same dropped vowel. Nerdesin? is the first thing a friend asks on the phone: where are you?"}],
 a2u1:[
  {w:"Ne oldu?",s:"N'oldu?",r:"herkes",re:1,n:"What happened? The two words run together, and in messages it is often written noldu."}],
 a2u2:[
  {w:"Gideceğim.",s:"Gidicem.",r:"herkes",re:1,n:"The future shrinks in speech: gideceğim becomes gidicem, yapacağım yapıcam, gelmeyeceğim gelmicem. Everyone says it; write it only to friends."},
  {w:"Ne yapacaksın?",s:"Napcan?",r:"samimi",re:1,n:"What are you going to do? Ne yapacaksın at full speed. Very casual."}],
 a2u3:[
  {w:"Nereye gidiyorsun? Eve gidiyorum.",s:"Nereye gidiyorsun? Eve.",r:"herkes",n:"A question is answered with just the part it asked for, with its case ending: Eve. Okula. Ankara'dan. The full sentence sounds recited."}],
 a2u6:[
  {w:"Bilmiyorum.",s:"Bilmem.",r:"herkes",n:"The aorist negative is the casual I don't know. Bilmem ki adds a shrug."},
  {w:"garson",s:"Bakar mısınız?",r:"herkes",n:"How you call a waiter or a shop assistant: would you look? Calling out garson sounds rude."}],
 a2u8:[
  {w:"seninle · benimle",s:"senle · benle",r:"samimi",re:1,n:"The genitive falls out before -le in casual speech: Senle geliyorum, I'm coming with you."}],
 a2u10:[
  {w:"efendim",s:"hocam · abi · abla",r:"herkes",n:"Strangers are addressed as family or as teachers: abi and abla to someone a little older, hocam to almost anyone, especially among the young. Efendim is the formal end."}]
};
