import { RAG_CHUNKS, RAG_INDEX } from "./rag-data.mjs";

export function loadRagIndex() {
  return { index: RAG_INDEX, chunks: RAG_CHUNKS };
}
