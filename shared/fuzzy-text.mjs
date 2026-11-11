/**
 * TYPO TOLERANCE FOR THE TWO SEARCH PAGES, as source, the way
 * shared/search-text.mjs ships norm(): /search.html and /cards.html are inline
 * scripts with no module loader, so the one copy lives here and each builder
 * inlines FUZZY_SRC verbatim.
 *
 * WHY IT EXISTS (11 November 2026). Measured on the built site: "charzard",
 * "delta rein" and "raikuo" all answered "Nothing matched" on both pages, with
 * Charizard, Delta Reign and Raikou one letter away. Every word had to match
 * exactly and nothing said what to try next.
 *
 * THE RULES, which the owner approved and which the callers must not loosen:
 *   - a word of 4 to 7 letters may be 1 edit from a word in the index;
 *   - a word of 8 or more may be 2 edits away;
 *   - a word under 4 letters, a word holding a digit ("30th", "136") and a
 *     quoted phrase are never corrected. Three letters one edit apart is most
 *     of the dictionary, and a number one digit off is a different card.
 * An edit is an insertion, a deletion, a substitution or a swap of two
 * neighbours (Damerau-Levenshtein, the optimal string alignment form), because
 * "pikahcu" is one slip of the fingers and plain Levenshtein charges it two.
 *
 * IT ONLY EVER RUNS AFTER THE EXACT MATCH FOUND NOTHING. Both pages try the
 * query as typed first, so this cannot reorder or dilute a search that works.
 *
 * COST. fuzzyAlts walks the unique-word vocabulary once per word. The length
 * test rejects most of it before any arithmetic, and editDistance gives up on a
 * row as soon as every cell is over budget. On the site index (about 9,000
 * unique words with the card index loaded) that is well under a millisecond a
 * word on a laptop.
 */

export const FUZZY_SRC = `function editDistance(a,b,max){
  var la=a.length, lb=b.length, i, j, c, m, p2=null, p1=[], cur;
  if(la-lb>max||lb-la>max) return max+1;
  for(j=0;j<=lb;j++) p1[j]=j;
  for(i=1;i<=la;i++){
    cur=[i]; m=i;
    for(j=1;j<=lb;j++){
      c=a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1;
      cur[j]=Math.min(p1[j]+1,cur[j-1]+1,p1[j-1]+c);
      if(p2&&j>1&&a.charCodeAt(i-1)===b.charCodeAt(j-2)&&a.charCodeAt(i-2)===b.charCodeAt(j-1)){
        cur[j]=Math.min(cur[j],p2[j-2]+1);
      }
      if(cur[j]<m) m=cur[j];
    }
    if(m>max) return max+1;
    p2=p1; p1=cur;
  }
  return p1[lb];
}
function fuzzyBudget(term){
  if(term.length<4||/[^a-z]/.test(term)) return 0;
  return term.length>=8?2:1;
}
function fuzzyAlts(term,vocab,limit){
  var max=fuzzyBudget(term), out=[];
  if(!max) return out;
  vocab.forEach(function(freq,w){
    if(w===term) return;
    var d=editDistance(term,w,max);
    if(d<=max) out.push({w:w,d:d,f:freq,s:w.charAt(0)===term.charAt(0)?1:0});
  });
  out.sort(function(x,y){ return x.d-y.d||y.s-x.s||y.f-x.f||(x.w<y.w?-1:1); });
  return out.slice(0,limit||5);
}
function vocabAdd(vocab,normText){
  var w=normText.split(" "), i;
  for(i=0;i<w.length;i++){
    if(w[i].length>=3&&!/[^a-z]/.test(w[i])) vocab.set(w[i],(vocab.get(w[i])||0)+1);
  }
}`;

/** Live copies for Node, so a builder can prove the shipped source at build time. */
export const { editDistance, fuzzyBudget, fuzzyAlts, vocabAdd } = new Function(
  `${FUZZY_SRC}\n return { editDistance, fuzzyBudget, fuzzyAlts, vocabAdd };`,
)();

/**
 * The cases the rules above are written from. Called by both builders, so a
 * change here that breaks one of them fails the build rather than the search.
 */
export function assertFuzzy() {
  const want = [
    ["charzard", "charizard", 2, 1],
    ["rein", "reign", 1, 1],
    ["pikahcu", "pikachu", 1, 1],
    ["raikuo", "raikou", 1, 1],
    ["umbreon", "umbreon", 1, 0],
    ["mew", "mewtwo", 2, 3],
    ["charizard", "blastoise", 2, 3],
  ];
  for (const [a, b, max, d] of want) {
    const got = editDistance(a, b, max);
    if (got !== d) throw new Error(`editDistance("${a}","${b}",${max}) is ${got}, expected ${d}`);
  }
  const budgets = [["mew", 0], ["rein", 1], ["raikuo", 1], ["charzard", 2], ["30th", 0], ["136", 0], ["delta reign", 0]];
  for (const [t, b] of budgets) {
    if (fuzzyBudget(t) !== b) throw new Error(`fuzzyBudget("${t}") is ${fuzzyBudget(t)}, expected ${b}`);
  }
  const v = new Map();
  vocabAdd(v, "charizard charmander reign rain 151 ex delta");
  vocabAdd(v, "delta reign");
  if (v.has("151") || v.has("ex") || !v.has("reign")) throw new Error("vocabAdd kept a number or a two letter word, or dropped a word");
  const top = (t) => (fuzzyAlts(t, v)[0] || {}).w;
  if (top("charzard") !== "charizard" || top("rein") !== "reign" || top("xyzqqq") !== undefined) {
    throw new Error("fuzzyAlts no longer corrects charzard and rein, or it corrects nonsense");
  }
}
