# Hybrid RAG Pipeline: BM25 + HyDE + RRF

## Context
The portfolio chatbot's `search_knowledge` tool uses simple keyword matching. Replace it with a hybrid RAG pipeline showcasing BM25, HyDE (Hypothetical Document Embeddings), RRF (Reciprocal Rank Fusion), and query expansion — as described in O'Reilly's Agentic AI Design Patterns.

**Constraint**: No external embedding APIs or subscriptions. Only Anthropic (already have). All retrieval is pure JS math + Claude for HyDE.

## How It Works

```
User query
  ↓
Query Expansion (static synonym map, pure JS)
  ↓
┌─────────────────────────────────────────┐
│ BM25 Retrieval          HyDE Retrieval  │
│ (expanded query         (Claude generates│
│  vs pre-computed         hypothetical    │
│  term index)             answer → BM25   │
│  → ranked list A         match)          │
│                          → ranked list B │
└─────────────────────────────────────────┘
  ↓
RRF Fusion (merge list A + B → top-5)
  ↓
Return { topic, content }[] (backward compatible)
```

**HyDE adaptation**: Traditional HyDE embeds the hypothetical doc as a vector. Since we're skipping dense retrieval, we BM25-match the hypothetical doc against chunks instead. Claude's generated paragraph introduces relevant vocabulary that the short user query lacks, dramatically improving BM25 recall.

## Architecture (iDesign Layers)

```
local-tool-provider.mjs (existing, modified)
  └── rag-pipeline.mjs (Engine) — orchestrates search
        ├── rag-index.mjs (Resource Accessor) — loads pre-computed BM25 index
        ├── bm25.mjs (Utility) — BM25 scoring
        ├── rrf.mjs (Utility) — Reciprocal Rank Fusion
        ├── query-expansion.mjs (Utility) — static synonym expansion
        └── text-utils.mjs (Utility) — tokenizer, stopwords, stemmer
```

Build-time:
```
scripts/build-rag-index.mjs
  ├── chunker.mjs (Utility) — KNOWLEDGE → Chunk[]
  ├── bm25.mjs (Utility) — builds index
  └── text-utils.mjs (Utility) — tokenization
  → OUTPUT: netlify/functions/data/bm25-index.json
```

## New Files

### `netlify/functions/text-utils.mjs` (Utility)
- `tokenize(text)` — lowercase, split on non-alphanumeric, remove stopwords, apply suffix stemming
- `STOPWORDS` — hardcoded Set (~175 common words)
- `stem(word)` — lightweight Porter-style suffix stripping (-ing, -tion, -ly, -ed, -er, etc.)
- Zero dependencies, pure JS

### `netlify/functions/chunker.mjs` (Utility)
- `chunkKnowledge(knowledge)` — returns `Chunk[]`
- Chunk shape: `{ id, topic, category, content, metadata }`
- ~33 chunks: 1 about + 5 projects + 9 experience + 3 skills + 2 education + 2 interests + 11 portfolio
- Deterministic `id` for stable index references (e.g. `"project-mcp-server-framework"`)
- Must export `KNOWLEDGE` from knowledge.mjs for the build script

### `netlify/functions/bm25.mjs` (Utility)
- `buildBm25Index(chunks, tokenizeFn)` — builds serializable index: `{ avgDl, docCount, docs: { [id]: { len, tf } }, idf }`
- `scoreBm25(query, index, tokenizeFn)` — returns `[{ id, score }]` sorted descending
- BM25 formula with k1=1.5, b=0.75
- `tokenizeFn` passed as parameter (dependency inversion)

### `netlify/functions/rrf.mjs` (Utility)
- `reciprocalRankFusion(rankedLists, options?)` — returns `[{ id, score }]`
- RRF formula: `score(d) = Σ 1/(k + rank(d, L))` with k=60
- `options.topN` defaults to 5

### `netlify/functions/query-expansion.mjs` (Utility)
- `expandQuery(query)` — returns expanded query string
- Static synonym map covering tech aliases, role terms, architecture terms
- E.g. "dotnet" → adds ".net", "c#"; "ai" → adds "machine learning", "llm"
- Zero latency, deterministic

### `netlify/functions/rag-index.mjs` (Resource Accessor)
- `loadRagIndex()` — loads `data/bm25-index.json` + `data/chunks.json` from disk
- Module-level caching (parsed once per cold start)
- Uses `readFileSync` + `import.meta.url` path resolution

### `netlify/functions/rag-pipeline.mjs` (Engine)
- `createRagPipeline(options?)` — factory returning `{ search(query) }`
- Pipeline steps:
  1. Query expansion via synonym map
  2. BM25 retrieval (expanded query vs pre-computed index) → ranked list A
  3. HyDE: Claude Haiku generates hypothetical answer paragraph → BM25 score it → ranked list B
  4. RRF fusion of list A + B → top-5
  5. Map chunk IDs back to `{ topic, content }` (backward compatible)
- HyDE wrapped in try/catch + 3s timeout → graceful degradation to BM25-only
- Falls back to keyword `searchKnowledge()` if index files missing

### `scripts/build-rag-index.mjs` (Build Script)
- Reads KNOWLEDGE, chunks it, builds BM25 index
- Writes `netlify/functions/data/bm25-index.json` and `netlify/functions/data/chunks.json`
- Pure JS, no external APIs needed
- Runs via `node scripts/build-rag-index.mjs`

## Quick Actions (Showcase Features)

Update `index.html` prompt chips and quick action buttons to showcase RAG + MCP:

**Prompt chips** (replace existing):
- "How does your RAG pipeline work?" → triggers portfolio knowledge about RAG
- "Search Microsoft docs for Azure Functions" → triggers MCP live demo
- "What's your AI architecture experience?" → HyDE expands this into rich retrieval

**Quick action buttons** (add alongside existing):
- `<i class="fas fa-magnifying-glass"></i> MS Docs` → data-query: "Search Microsoft documentation for Model Context Protocol" (MCP demo)
- `<i class="fas fa-brain"></i> RAG Demo` → data-query: "How does this chatbot's retrieval pipeline work? What techniques does it use?" (RAG self-description)
- `<i class="fas fa-robot"></i> Architecture` → data-query: "Explain how this site's chatbot integrates MCP tools with a SOLID tool provider architecture" (architecture showcase)

## Modified Files

### `netlify/functions/knowledge.mjs`
- Export `KNOWLEDGE` (currently only used internally — add named export)
- Add `portfolio.ragPipeline` topic describing the RAG architecture
- `searchKnowledge()` retained as fallback

### `netlify/functions/local-tool-provider.mjs`
- `search_knowledge` executor: swap `searchKnowledge(input.query)` → `await pipeline.search(input.query)`
- Import `createRagPipeline`, lazy-initialize once per cold start
- Executor becomes async (already compatible — `registry.executeTool` uses `await`)

### `netlify.toml`
- Add `command = "node scripts/build-rag-index.mjs"` to `[build]`
- Add `included_files = ["netlify/functions/data/*.json"]` to `[functions]`

### `package.json`
- Add `"build:rag": "node scripts/build-rag-index.mjs"` to scripts

### `.gitignore`
- Add `netlify/functions/data/` (generated at build time)

### `index.html`
- Update prompt chips to showcase RAG + MCP features
- Add quick action buttons for MS Docs, RAG Demo, Architecture

### `sw.js`
- Bump cache `v1.4.0` → `v1.5.0`

## No New Dependencies
Everything is pure JS + existing Anthropic SDK for HyDE. Zero new npm packages.

## Latency Budget
| Step | Time |
|---|---|
| Query expansion | <1ms |
| BM25 scoring (33 chunks) | <1ms |
| HyDE: Claude Haiku call | 800-2000ms |
| HyDE: BM25 re-scoring | <1ms |
| RRF fusion | <1ms |
| **Total without HyDE** | **<5ms** |
| **Total with HyDE** | **~1-2s** |

## Implementation Order
1. `text-utils.mjs` (shared tokenizer)
2. `chunker.mjs` (KNOWLEDGE → chunks)
3. `bm25.mjs` (index builder + scorer)
4. `rrf.mjs` (fusion)
5. `query-expansion.mjs` (synonyms)
6. `scripts/build-rag-index.mjs` → run it → verify `data/` output
7. `rag-index.mjs` (loads the data)
8. `rag-pipeline.mjs` (composes everything)
9. Modify `local-tool-provider.mjs` (swap search_knowledge)
10. Modify `knowledge.mjs` (export KNOWLEDGE, add ragPipeline topic)
11. Update `netlify.toml`, `package.json`, `.gitignore`, `sw.js`

## Verification
1. Run `node scripts/build-rag-index.mjs` — verify JSON files created
2. Test locally: "tell me about Logan's experience at Derivco" → should retrieve experience chunk
3. Test HyDE: "what does Logan know about AI?" → HyDE should expand to relevant terms
4. Test fallback: remove data/ dir, verify chatbot still works via keyword fallback
5. Deploy to Netlify → verify build log shows "RAG index built successfully"
