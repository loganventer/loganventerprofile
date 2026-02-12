import Anthropic from "@anthropic-ai/sdk";
import { tokenize } from "./text-utils.mjs";
import { scoreBm25 } from "./bm25.mjs";
import { reciprocalRankFusion } from "./rrf.mjs";
import { expandQuery } from "./query-expansion.mjs";
import { loadRagIndex } from "./rag-index.mjs";
import { searchKnowledge } from "./knowledge.mjs";

const HYDE_TIMEOUT_MS = 3000;
const HYDE_MODEL = "claude-haiku-4-5-20251001";

export function createRagPipeline(options) {
  const apiKey = (options && options.apiKey) || process.env.ANTHROPIC_API_KEY;

  return {
    async search(query) {
      // Load pre-computed index
      let index, chunks;
      try {
        const data = loadRagIndex();
        index = data.index;
        chunks = data.chunks;
      } catch {
        // Fallback to keyword search if index files missing
        return JSON.stringify(searchKnowledge(query));
      }

      const chunkMap = new Map(chunks.map((c) => [c.id, c]));

      // Step 1: Query expansion
      const expanded = expandQuery(query);

      // Step 2: BM25 retrieval on expanded query
      const bm25Results = scoreBm25(expanded, index, tokenize);

      // Step 3: HyDE retrieval (Claude generates hypothetical answer → BM25 match)
      let hydeResults = [];
      if (apiKey) {
        try {
          hydeResults = await hydeRetrieval(query, index, apiKey);
        } catch {
          // HyDE failure is non-fatal — BM25-only results still work
        }
      }

      // Step 4: RRF fusion
      const rankedLists = [bm25Results];
      if (hydeResults.length > 0) {
        rankedLists.push(hydeResults);
      }
      const fused = reciprocalRankFusion(rankedLists, { topN: 5 });

      // Step 5: Map back to { topic, content } (backward compatible)
      const results = fused
        .map((r) => {
          const chunk = chunkMap.get(r.id);
          if (!chunk) return null;
          return { topic: chunk.topic, content: chunk.content };
        })
        .filter(Boolean);

      if (results.length === 0) {
        return JSON.stringify(searchKnowledge(query));
      }

      return JSON.stringify(results);
    },
  };
}

async function hydeRetrieval(query, index, apiKey) {
  const client = new Anthropic({ apiKey });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("HyDE timeout")), HYDE_TIMEOUT_MS)
  );

  const completion = Promise.resolve().then(async () => {
    const response = await client.messages.create({
      model: HYDE_MODEL,
      max_tokens: 200,
      system: "You are a knowledge base assistant. Given a question, write a short factual paragraph that would answer it. Write as if you are describing a real person's professional background. Be specific with technologies, companies, and achievements.",
      messages: [{ role: "user", content: query }],
    });

    const hypoDoc = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return scoreBm25(hypoDoc, index, tokenize);
  });

  return Promise.race([completion, timeout]);
}
