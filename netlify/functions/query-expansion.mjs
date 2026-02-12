const SYNONYM_MAP = {
  "dotnet": [".net", "c#", "csharp"],
  ".net": ["dotnet", "c#", "csharp"],
  "c#": ["csharp", "dotnet", ".net"],
  "csharp": ["c#", "dotnet", ".net"],
  "ai": ["artificial intelligence", "machine learning", "llm", "ml"],
  "ml": ["machine learning", "ai", "artificial intelligence"],
  "llm": ["large language model", "ai", "claude", "gpt"],
  "rag": ["retrieval augmented generation", "vector search", "semantic search"],
  "mcp": ["model context protocol", "tool calling", "ai agent"],
  "langchain": ["langgraph", "llm orchestration"],
  "langgraph": ["langchain", "agent orchestration"],
  "react": ["frontend", "typescript", "web"],
  "flutter": ["dart", "mobile", "cross-platform"],
  "docker": ["container", "deployment", "devops"],
  "azure": ["cloud", "microsoft", "devops"],
  "grpc": ["protocol", "transport", "signalr"],
  "signalr": ["protocol", "transport", "grpc", "websocket"],
  "sse": ["server-sent events", "streaming", "event stream"],
  "websocket": ["real-time", "streaming", "signalr"],
  "idesign": ["architecture", "methodology", "juval lowy", "clean architecture"],
  "solid": ["design principles", "architecture", "clean code"],
  "ddd": ["domain-driven design", "architecture"],
  "devops": ["ci/cd", "pipeline", "deployment", "docker"],
  "security": ["authentication", "jwt", "encryption", "owasp"],
  "jwt": ["authentication", "token", "security"],
  "python": ["fastapi", "langchain", "pydantic"],
  "fastapi": ["python", "api", "backend"],
  "sql": ["database", "t-sql", "postgresql", "sqlite"],
  "vector": ["embedding", "qdrant", "faiss", "semantic search"],
  "qdrant": ["vector database", "semantic search", "embedding"],
  "faiss": ["vector database", "semantic search", "embedding"],
  "music": ["guitar", "vocalist", "songwriting", "album"],
  "game": ["mobile game", "windows phone", "app"],
  "education": ["diploma", "degree", "school", "college"],
  "chatbot": ["ai assistant", "agent", "bot", "chat"],
  "portfolio": ["website", "site", "this site"],
  "experience": ["work", "career", "job", "employment"],
  "senior": ["lead", "principal", "architect"],
};

export function expandQuery(query) {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);
  const additions = new Set();

  for (const word of words) {
    const synonyms = SYNONYM_MAP[word];
    if (synonyms) {
      for (const syn of synonyms) {
        additions.add(syn);
      }
    }
  }

  // Also check multi-word phrases
  for (const [phrase, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      for (const syn of synonyms) {
        additions.add(syn);
      }
    }
  }

  if (additions.size === 0) return query;
  return query + " " + [...additions].join(" ");
}
