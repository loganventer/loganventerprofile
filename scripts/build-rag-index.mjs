import { KNOWLEDGE } from "../netlify/functions/knowledge.mjs";
import { chunkKnowledge } from "../netlify/functions/chunker.mjs";
import { buildBm25Index } from "../netlify/functions/bm25.mjs";
import { tokenize } from "../netlify/functions/text-utils.mjs";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "netlify", "functions", "data");

mkdirSync(dataDir, { recursive: true });

console.log("Building RAG index...");

const chunks = chunkKnowledge(KNOWLEDGE);
console.log(`  Chunked knowledge into ${chunks.length} chunks`);

const index = buildBm25Index(chunks, tokenize);
console.log(`  BM25 index: ${Object.keys(index.docs).length} docs, ${Object.keys(index.idf).length} terms`);
console.log(`  Average document length: ${index.avgDl.toFixed(1)} tokens`);

writeFileSync(join(dataDir, "chunks.json"), JSON.stringify(chunks, null, 2));
writeFileSync(join(dataDir, "bm25-index.json"), JSON.stringify(index));

console.log("RAG index built successfully");
console.log(`  → ${dataDir}/chunks.json`);
console.log(`  → ${dataDir}/bm25-index.json`);
