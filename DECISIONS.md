# Material decisions

- **Next.js App Router + SQLite:** one process and one file database keep setup reliable while retaining real server-side persistence and route handlers.
- **Built-in `node:sqlite`:** avoids native add-on installation and keeps the data layer explicit. The project therefore requires Node 22.13 or newer (Node 24 recommended).
- **Curated evidence, not invented outcomes:** two Ottawa cases are seeded from the research brief and official URLs. Fixture text is a small representative snapshot with retrieval metadata, not a claim of complete source reproduction.
- **Offline-first checks:** saved snapshots are the default. Live fetching is opt-in in code and restricted to allowlisted Ottawa hosts; the demo never depends on it.
- **Rules before semantics:** exact IDs, explicit parent relationships, and official links establish facts. Semantic extraction can add grounded interpretation but cannot override identifiers.
- **Three semantic providers:** tests and ordinary snapshot checks use a deterministic fixture provider; explicit analysis defaults to the local MLX/Qwen OpenAI-compatible server; hosted OpenAI remains opt-in. All share one grounded schema and content-hash cache.
- **Model output stays reviewable:** semantic results appear separately from deterministic facts. Strict JSON validation and exact source-span validation run before caching; model output never overwrites official identifiers or curated decisions.
