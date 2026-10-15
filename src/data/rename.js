/* Vocabulary glosses reworded, old "tr|en" key → new. The star queue and its
   schedule are keyed by the Turkish and the English together, so a reworded
   gloss would otherwise orphan its review box; load2() moves each old key to
   its new one (vocabRename(), app.core.js). Append only, in the order the
   renames were made, so a word renamed twice follows its chain. */
const VOCAB_RENAME={
 "anlaşmazlık|misunderstanding":"anlaşmazlık|disagreement, misunderstanding",
 "savunmak|to defend a position":"savunmak|to defend (a position)",
 "bakar mısınız|excuse me (calling)":"bakar mısınız|excuse me (calling; lit. would you look)",
 "duacınız|your well-wisher":"duacınız|your well-wisher (lit. the one who prays for you)",
 "düşmek|to drop":"düşmek|to fall; to drop (of a sound)",
};
