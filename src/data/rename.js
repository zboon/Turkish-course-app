/* Vocabulary glosses reworded, old "tr|en" key → new. The star queue and its
   schedule are keyed by the Turkish and the English together, so a reworded
   gloss would otherwise orphan its review box; load2() moves each old key to
   its new one (vocabRename(), app.core.js). Append only, in the order the
   renames were made, so a word renamed twice follows its chain. */
const VOCAB_RENAME={
};
