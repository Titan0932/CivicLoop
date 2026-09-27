# CivicLoop implementation plan

1. **Foundation and data** — initialize Next.js, SQLite schema, repeatable seed, and verified Ottawa fixture graph. Check: `npm run db:reset`, query tests.
2. **Core experience** — dashboard, search/filters, analytics, detail timeline, evidence, feedback, commitments, local follows. Check: render/build and smoke requests.
3. **Evidence pipeline** — Engage Ottawa and eScribe parsers, deterministic matcher, semantic provider boundary and cache. Check: fixture and safety tests.
4. **Update detection** — allowlisted fetcher, normalization/hashing, check records, idempotent event creation, UI and CLI entry points. Check: unchanged/changed/repeat/failure tests.
5. **Hardening and handoff** — accessibility/responsive review, security boundaries, full clean verification, README and demo rehearsal. Check: `npm run verify` plus production-server smoke path.

P0 is required. The third case study, live-source refresh, and richer analytics are P1/P2 and must not compromise the offline demo.
