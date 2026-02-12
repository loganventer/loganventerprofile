const DEFAULT_K = 60;
const DEFAULT_TOP_N = 5;

export function reciprocalRankFusion(rankedLists, options) {
  const k = (options && options.k) || DEFAULT_K;
  const topN = (options && options.topN) || DEFAULT_TOP_N;

  const scores = new Map();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank].id;
      const prev = scores.get(id) || 0;
      scores.set(id, prev + 1 / (k + rank + 1));
    }
  }

  const fused = [];
  for (const [id, score] of scores) {
    fused.push({ id, score });
  }

  fused.sort((a, b) => b.score - a.score);
  return fused.slice(0, topN);
}
