import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");

let cachedIndex = null;
let cachedChunks = null;

export function loadRagIndex() {
  if (cachedIndex && cachedChunks) {
    return { index: cachedIndex, chunks: cachedChunks };
  }

  const indexData = readFileSync(join(dataDir, "bm25-index.json"), "utf-8");
  const chunksData = readFileSync(join(dataDir, "chunks.json"), "utf-8");

  cachedIndex = JSON.parse(indexData);
  cachedChunks = JSON.parse(chunksData);

  return { index: cachedIndex, chunks: cachedChunks };
}
