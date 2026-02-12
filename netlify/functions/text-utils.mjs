const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "get", "got", "had", "hadn't",
  "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's",
  "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how",
  "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't",
  "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
  "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
  "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
  "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
  "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
  "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
  "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
  "whom", "why", "why's", "will", "with", "won't", "would", "wouldn't", "you",
  "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "also", "just", "like", "well", "back", "even", "still", "way", "take", "since",
  "another", "however", "many", "much", "every", "make", "made", "know", "known",
  "use", "used", "using", "one", "two", "new", "now", "old", "see", "time", "very",
  "when", "come", "work", "first", "last", "long", "great", "little", "own", "other",
  "right", "big", "high", "different", "small", "large", "next", "early", "young",
  "important", "public", "good", "give", "day", "keep", "say", "help", "ask",
]);

const SUFFIX_RULES = [
  [/ational$/, "ate"],
  [/tional$/, "tion"],
  [/enci$/, "ence"],
  [/anci$/, "ance"],
  [/izer$/, "ize"],
  [/alism$/, "al"],
  [/iveness$/, "ive"],
  [/fulness$/, "ful"],
  [/ousness$/, "ous"],
  [/aliti$/, "al"],
  [/iviti$/, "ive"],
  [/biliti$/, "ble"],
  [/ation$/, "ate"],
  [/ment$/, ""],
  [/ness$/, ""],
  [/ings$/, ""],
  [/ing$/, ""],
  [/ies$/, "i"],
  [/ied$/, "i"],
  [/ement$/, ""],
  [/ously$/, "ous"],
  [/ively$/, "ive"],
  [/fully$/, "ful"],
  [/lessly$/, "less"],
  [/ally$/, "al"],
  [/ity$/, ""],
  [/ment$/, ""],
  [/able$/, ""],
  [/ible$/, ""],
  [/ful$/, ""],
  [/less$/, ""],
  [/ness$/, ""],
  [/ers$/, ""],
  [/ed$/, ""],
  [/er$/, ""],
  [/es$/, ""],
  [/ly$/, ""],
  [/s$/, ""],
];

export function stem(word) {
  if (word.length < 4) return word;
  for (const [pattern, replacement] of SUFFIX_RULES) {
    if (pattern.test(word)) {
      const result = word.replace(pattern, replacement);
      if (result.length >= 3) return result;
    }
  }
  return word;
}

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#+.\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map(stem);
}
