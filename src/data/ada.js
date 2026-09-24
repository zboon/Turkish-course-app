/* Adacıklar: the questions a language island is built from. An island is
   a topic from the learner's own life; each question is asked in
   Turkish, in the grammar of the unit `u`, and opens when that unit's
   grammar has been read. `eg` is a model answer, there to adapt, not to
   copy. Island ids and question ids are permanent: every sentence the
   learner writes is filed under "<island>.<question>", so renaming one
   strands what was written under it. Add questions at the end of an
   island rather than renaming. */
const ADA=[
 {id:"ben",tr:"Kendim",en:"About me",q:[
  {id:"ad",u:"a1u1",tr:"Adın ne?",en:"What is your name?",eg:["Benim adım Deniz.","My name is Deniz."]},
  {id:"nereli",u:"a1u1",tr:"Nerelisin?",en:"Where are you from?",eg:["Londralıyım.","I am from London."]},
  {id:"yas",u:"a1u4",tr:"Kaç yaşındasın?",en:"How old are you?",eg:["Otuz iki yaşındayım.","I am thirty-two."]},
  {id:"dil",u:"a2u4",tr:"Hangi dilleri konuşabiliyorsun?",en:"Which languages can you speak?",eg:["İngilizce ve biraz Türkçe konuşabiliyorum.","I can speak English and a little Turkish."]},
  {id:"neden",u:"b1u6",tr:"Türkçeyi neden öğreniyorsun?",en:"Why are you learning Turkish?",eg:["Arkadaşlarımla Türkçe konuşmak için öğreniyorum.","I am learning it to speak Turkish with my friends."]}]},
 {id:"aile",tr:"Ailem",en:"My family",q:[
  {id:"adi",u:"a1u3",tr:"Annenin adı ne?",en:"What is your mother's name?",eg:["Annemin adı Ayşe.","My mother's name is Ayşe."]},
  {id:"kimler",u:"a1u4",tr:"Ailende kimler var?",en:"Who is in your family?",eg:["Annem, babam ve bir kız kardeşim var.","My mother, my father and a sister."]},
  {id:"simdi",u:"a1u5",tr:"Annen şu an ne yapıyor?",en:"What is your mother doing right now?",eg:["Annem şu an evde kitap okuyor.","My mother is reading a book at home right now."]},
  {id:"buyuk",u:"a2u5",tr:"Kardeşin senden büyük mü?",en:"Is your brother or sister older than you?",eg:["Evet, ablam benden iki yaş büyük.","Yes, my sister is two years older than me."]},
  {id:"cocukken",u:"b1u9",tr:"Çocukken ailenle ne yapardın?",en:"What did you use to do with your family as a child?",eg:["Çocukken her yaz ailemle denize giderdik.","As a child I used to go to the sea with my family every summer."]}]},
 {id:"ev",tr:"Evim",en:"My home",q:[
  {id:"nerede",u:"a1u4",tr:"Evin nerede?",en:"Where is your home?",eg:["Evim şehir merkezinde, bir parkın yanında.","My home is in the city centre, next to a park."]},
  {id:"oda",u:"a1u4",tr:"Evinde kaç oda var?",en:"How many rooms are there in your home?",eg:["Evimde üç oda var.","There are three rooms in my home."]},
  {id:"odanda",u:"a1u4",tr:"Odanda neler var?",en:"What is there in your room?",eg:["Odamda bir yatak, bir masa ve çok kitap var.","In my room there is a bed, a table and a lot of books."]},
  {id:"nasil",u:"a1u7",tr:"Evin nasıl?",en:"What is your home like?",eg:["Evim küçük ama çok aydınlık.","My home is small but very bright."]},
  {id:"yol",u:"a2u8",tr:"İşe ya da okula nasıl gidiyorsun?",en:"How do you get to work or school?",eg:["İşe otobüsle gidiyorum.","I go to work by bus."]}]},
 {id:"gun",tr:"Günüm",en:"My day",q:[
  {id:"kahvalti",u:"a1u5",tr:"Kahvaltıda ne yiyorsun?",en:"What do you eat for breakfast?",eg:["Kahvaltıda ekmek, peynir ve zeytin yiyorum.","For breakfast I eat bread, cheese and olives."]},
  {id:"kalk",u:"a1u6",tr:"Sabah kaçta kalkıyorsun?",en:"What time do you get up in the morning?",eg:["Sabah yedide kalkıyorum.","I get up at seven in the morning."]},
  {id:"dun",u:"a2u1",tr:"Dün ne yaptın?",en:"What did you do yesterday?",eg:["Dün bir arkadaşımla sinemaya gittim.","Yesterday I went to the cinema with a friend."]},
  {id:"aksam",u:"a2u6",tr:"Akşamları genellikle ne yaparsın?",en:"What do you usually do in the evenings?",eg:["Akşamları genellikle kitap okurum.","In the evenings I usually read a book."]},
  {id:"eve",u:"b1u4",tr:"Eve gelince ne yaparsın?",en:"What do you do when you get home?",eg:["Eve gelince bir çay içip dinlenirim.","When I get home I have a tea and rest."]}]},
 {id:"is",tr:"İşim ya da okulum",en:"Work or study",q:[
  {id:"ne",u:"a1u5",tr:"Ne iş yapıyorsun?",en:"What do you do for a living?",eg:["Öğretmenim, bir okulda çalışıyorum.","I am a teacher; I work at a school."]},
  {id:"nerede",u:"a1u5",tr:"Nerede çalışıyorsun ya da okuyorsun?",en:"Where do you work or study?",eg:["Bir bankada çalışıyorum.","I work at a bank."]},
  {id:"sure",u:"a2u7",tr:"Ne zamandır orada çalışıyorsun?",en:"How long have you been working there?",eg:["Üç yıldır orada çalışıyorum.","I have been working there for three years."]},
  {id:"sev",u:"b1u3",tr:"İşinde en sevdiğin şey ne?",en:"What do you like most about your work?",eg:["İşimde en sevdiğim şey insanlarla konuşmak.","What I like most about my work is talking to people."]},
  {id:"zorunda",u:"b2u2",tr:"İşte her gün ne yapmak zorundasın?",en:"What do you have to do every day at work?",eg:["Her gün çok e-posta yazmak zorundayım.","I have to write a lot of emails every day."]}]},
 {id:"bos",tr:"Boş zamanım",en:"Free time",q:[
  {id:"hobi",u:"a1u5",tr:"Boş zamanında ne yapıyorsun?",en:"What do you do in your free time?",eg:["Boş zamanımda yürüyüş yapıyorum ve müzik dinliyorum.","In my free time I go walking and listen to music."]},
  {id:"yemek",u:"a2u5",tr:"En sevdiğin yemek ne?",en:"What is your favourite food?",eg:["En sevdiğim yemek mercimek çorbası.","My favourite food is lentil soup."]},
  {id:"haftasonu",u:"a2u6",tr:"Hafta sonları ne yaparsın?",en:"What do you do at weekends?",eg:["Hafta sonları genellikle parka giderim.","At weekends I usually go to the park."]}]},
 {id:"plan",tr:"Planlarım",en:"My plans",q:[
  {id:"hafta",u:"a2u2",tr:"Bu hafta sonu ne yapacaksın?",en:"What are you going to do this weekend?",eg:["Bu hafta sonu annemi ziyaret edeceğim.","This weekend I am going to visit my mother."]},
  {id:"gitmek",u:"a2u2",tr:"Gelecek yıl nereye gitmek istiyorsun?",en:"Where do you want to go next year?",eg:["Gelecek yıl Kapadokya'ya gitmek istiyorum.","Next year I want to go to Cappadocia."]},
  {id:"para",u:"b1u2",tr:"Çok paran olsa ne yapardın?",en:"What would you do if you had a lot of money?",eg:["Çok param olsa denize yakın bir ev alırdım.","If I had a lot of money I would buy a house near the sea."]},
  {id:"turkce",u:"b2u2",tr:"Türkçen için bu yıl ne yapmalısın?",en:"What should you do for your Turkish this year?",eg:["Her gün biraz Türkçe dinlemeliyim.","I should listen to a little Turkish every day."]}]},
 {id:"gecmis",tr:"Geçmişim",en:"My past",q:[
  {id:"yaz",u:"a2u1",tr:"Geçen yaz nereye gittin?",en:"Where did you go last summer?",eg:["Geçen yaz ailemle İzmir'e gittim.","Last summer I went to İzmir with my family."]},
  {id:"buyudun",u:"a2u1",tr:"Nerede büyüdün?",en:"Where did you grow up?",eg:["Küçük bir kasabada büyüdüm.","I grew up in a small town."]},
  {id:"cocuk",u:"b1u9",tr:"Çocukken boş zamanlarında ne yapardın?",en:"What did you use to do in your free time as a child?",eg:["Çocukken her gün sokakta top oynardım.","As a child I used to play football in the street every day."]},
  {id:"sehir",u:"b1u3",tr:"Gördüğün en güzel şehir hangisi?",en:"What is the most beautiful city you have seen?",eg:["Gördüğüm en güzel şehir Mardin.","The most beautiful city I have seen is Mardin."]}]}
];
