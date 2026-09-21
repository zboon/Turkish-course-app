/* Word classes for the vocabulary list. Verbs are derivable (-mak/-mek)
   and so are multiword entries, so only the rest is listed here:

     s  sıfat · adjective
     z  zarf · adverb
     e  edat, bağlaç, zamir · postpositions, conjunctions, pronouns
     i  ifade · greetings, particles, set phrases

   An unlisted single word is a noun and an unlisted multiword entry is
   an expression — both honest defaults. Infinitives are never listed:
   -mak/-mek already settles them. validate.js fails if a key here is not
   a word the course actually teaches, so typos cannot rot quietly.

   Multiword entries need listing more than single ones do: "hafta sonu"
   is a noun, "burnu büyük" an adjective and "ara sıra" an adverb, and
   none of that is guessable from the space. */
const POS={
 /* --- sıfat --- */
 "büyük":"s","küçük":"s","uzun":"s","kısa":"s","yeni":"s","beyaz":"s","siyah":"s",
 "kırmızı":"s","mavi":"s","yeşil":"s","sarı":"s","sıcak":"s","soğuk":"s","düz":"s",
 "birinci":"s","yarım":"s","kalabalık":"s","sakin":"s","pahalı":"s","ucuz":"s",
 "hasta":"s","fakir":"s","akıllı":"s","yaşlı":"s","yeterli":"s","kesin":"s",
 "imkânsız":"s","mümkün":"s","emin":"s","düzenli":"s","ıslak":"s","pişman":"s",
 "güvenilir":"s","derin":"s","ıssız":"s","paramparça":"s","ilgili":"s","sade":"s",
 "millî":"s","geçerli":"s","acayip":"s","silik":"s","sıradan":"s","tuzlu":"s",
 "tutarlı":"s","dolaylı":"s","akıcı":"s","sadık":"s","mukaddes":"s","şayan":"s",
 "ölçünlü":"s","kaba":"s","sağ":"s","sol":"s","müsait":"s",

 /* --- zarf --- */
 "bugün":"z","yarın":"z","dün":"z","erken":"z","geç":"z","belki":"z","daha":"z",
 "en":"z","genellikle":"z","bazen":"z","asla":"z","önce":"z","sonra":"z","hâlâ":"z",
 "artık":"z","henüz":"z","birden":"z","sonunda":"z","nihayet":"z","önceden":"z",
 "galiba":"z","herhâlde":"z","ansızın":"z","birlikte":"z","bilâhare":"z",
 "tersinden":"z","masumane":"z",

 /* --- edat, bağlaç, zamir --- */
 "var":"e","yok":"e","kadar":"e","gibi":"e","için":"e","göre":"e","hakkında":"e",
 "dolayı":"e","rağmen":"e","doğru":"e","karşı":"e","yerine":"e","beri":"e",
 "boyunca":"e","zorunda":"e","takdirde":"e","hâlinde":"e","suretiyle":"e",
 "yanında":"e","herkes":"e","hepsi":"e","tane":"e","anda":"e","ekte":"e","gereği":"e",

 /* --- ifade --- */
 "merhaba":"i","günaydın":"i","evet":"i","hayır":"i","nasılsın?":"i","görüşürüz":"i",
 "lütfen":"i","efendim":"i","keşke":"i","meğer":"i","hani":"i","işte":"i","canım":"i",
 "yahu":"i","valla":"i","neyse":"i","falan":"i","ya":"i","saygılarımla":"i",
 "duacınız":"i","bâkî":"i",

 /* --- multiword entries, where the space says nothing --- */
 "hafta sonu":"n","sokak lambası":"n","karşı kıyı":"n","gölge oyunu":"n",
 "özlü söz":"n","kaynak dil":"n","erek dil":"n","ad / isim":"n","ağabey (abi)":"n",
 "eli açık":"s","ağzı sıkı":"s","burnu büyük":"s",
 "her zaman":"z","evvel zaman içinde":"z","ömür boyu":"z","o sırada":"z",
 "şırıl şırıl":"z","mırıl mırıl":"z","apar topar":"z","er geç":"z",
 "ara sıra":"z","tıka basa":"z",
 "ile (-le/-la)":"e"
};
