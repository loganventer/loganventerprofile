const K1 = 1.5;
const B = 0.75;

export function buildBm25Index(chunks, tokenizeFn) {
  const docs = {};
  let totalLen = 0;

  for (const chunk of chunks) {
    const tokens = tokenizeFn(chunk.content);
    const tf = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }
    docs[chunk.id] = { len: tokens.length, tf };
    totalLen += tokens.length;
  }

  const docCount = chunks.length;
  const avgDl = totalLen / docCount;

  // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
  const df = {};
  for (const doc of Object.values(docs)) {
    for (const term of Object.keys(doc.tf)) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const [term, freq] of Object.entries(df)) {
    idf[term] = Math.log((docCount - freq + 0.5) / (freq + 0.5) + 1);
  }

  return { avgDl, docCount, docs, idf };
}

export function scoreBm25(query, index, tokenizeFn) {
  const queryTerms = tokenizeFn(query);
  const scores = [];

  for (const [id, doc] of Object.entries(index.docs)) {
    let score = 0;
    for (const term of queryTerms) {
      const termIdf = index.idf[term];
      if (!termIdf) continue;
      const termTf = doc.tf[term] || 0;
      if (termTf === 0) continue;
      const numerator = termTf * (K1 + 1);
      const denominator = termTf + K1 * (1 - B + B * (doc.len / index.avgDl));
      score += termIdf * (numerator / denominator);
    }
    if (score > 0) {
      scores.push({ id, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}
