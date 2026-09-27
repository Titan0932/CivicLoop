# CivicLoop

CivicLoop is an independent civic-transparency MVP for Ottawa. It connects public consultations to results, formal decisions, and implementation commitments, while showing the official evidence and the reason records were linked.

The curated demo is intentionally offline-reliable: it runs from small saved snapshots of official records and requires no credentials. Community-submitted cases use guarded live retrieval and are enriched by Gemini when a key is configured, with automatic fallback to the local Qwen model. Original municipal links remain visible beside every claim.

## Requirements and setup

- Node.js 22.13+ (Node 24 recommended; the app uses the built-in SQLite module)
- npm 10+

```bash
npm install
cp .env.example .env.local       # optional; fixture mode needs no values
npm run db:reset                 # create and seed data/civicloop.db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The seed is idempotent; `npm run db:seed` can be run again without duplicating records. `npm run db:reset` safely resets only CivicLoop tables and recreates the curated demo data.

## Commands

```bash
npm run db:seed          # initialize/migrate and idempotently seed
npm run db:reset         # reset CivicLoop data, then seed
npm run dev              # local development server
npm run build            # production build
npm start                # run the production build
npm test                 # 28 offline unit/integration tests
npm run lint             # ESLint
npm run typecheck        # strict TypeScript check
npm run verify           # lint + types + tests + production build
npm run check-updates    # check saved snapshots; AI runs only for changed content
npm run check-consultation -- field-street-sidewalk  # live-check one tracked consultation
npm run analyze-consultation -- field-street-sidewalk --live  # Gemini-first LLM analysis
npm run monitor          # live-check consultations whose next-check time is due
npm run monitor -- --all # run a live monitoring cycle for every tracked case
npm run monitor -- --watch --interval-minutes=60 # keep the local monitor running
```

### Tracking and notification demo

The home page separates **My tracking**—the current user’s personal watchlist—from **All consultations**, the shared case directory. Tracking and untracking are persisted in SQLite rather than browser storage.

Open `/notifications` to choose in-app, email, and SMS delivery channels. Open `/demo/notifications` to publish a mock consultation update. The demo writes a durable domain event, runs it through the subscriber worker immediately, and creates one delivery record per enabled channel. In-app notifications are functional. Email and SMS are intentionally simulated in the delivery log until external delivery providers are connected.

### Community-submitted consultations

Paste an allowlisted official Ottawa consultation URL into the dashboard. CivicLoop first resolves it against previously stored source URLs. If the case is new, it retrieves the submitted page and its directly linked official records, creates a shared case, schedules those sources for monitoring, and records the request. Gemini-first enrichment with local-Qwen fallback continues after the case becomes available, so a hosted-model outage does not discard the collected evidence.

This is cumulative for everyone using the same SQLite database: the first request creates the case and later requests open the existing record. The workflow accepts official URLs rather than unrestricted text search so that it cannot silently associate a similarly named but unrelated project.

### Check or discover one consultation

Pass a tracked CivicLoop slug/ID to fetch every linked source live and write a consolidated evidence report:

```bash
npm run check-consultation -- field-street-sidewalk
npm run check-consultation -- con-community-gardens
```

Pass a new official Ottawa consultation URL to inspect its directly linked official documents without importing it:

```bash
npm run check-consultation -- https://engage.ottawa.ca/alexander-community-centre
```

Reports are written to `reports/<consultation>-latest.md` and `.json`. For a tracked consultation, add `--saved` to avoid network access and check its saved snapshots instead. Live and fixture hashes are stored separately, so switching modes cannot create false change events.

Discovery deliberately follows bounded direct official links and exact attachment relationships. It does not claim to have found unrelated committee records merely because their titles look similar; those require a formal identifier, official link, multiple independent signals, or review before import.

Live retrieval is available from the dashboard, consultation casefile, targeted CLI, and monitor. It is restricted to an explicit Ottawa host allowlist, validates DNS destinations and redirects, enforces time/size/content-type limits, and may fail when an official site blocks automated requests. A failed fetch is recorded as a retrieval failure—not as “no public update.” The curated judge path does not need live retrieval.

## Three-minute demo

1. Start on the dashboard. Point out the modest counts, lifecycle labels, saved-snapshot notice, filters, and local Follow control.
2. Open **Community-led Green Initiatives and Garden Program**.
3. Show the earlier aliases, including **Community Garden Action Plan Review**. In “Why these records match,” show that an official attachment relationship, report metadata, distinctive subject, and chronology connect the renamed records—not title equality.
4. Walk down the decision trail: 2023 direction, What We Learned report, committee recommendation, and the April 30, 2025 carried Council decision.
5. Compare resident themes to documented responses, then open an original eScribe or Engage Ottawa source.
6. Open **How we know** and click **Check official records now**. The browser checks the live allowlisted sources; unchanged pages skip semantic extraction.
7. Return to the dashboard, paste a new Engage Ottawa URL into **Can’t find a consultation?**, and show that the case becomes reusable community tracking data.
8. Open **Field Street Sidewalk** and show the documented response to tree and drainage concerns.

## Architecture

```text
Next.js UI and route handler
  ├─ personal tracking list, shared directory, and public activity feed
  ├─ guarded community-submission and live-check endpoints
  └─ notification inbox, preferences, and event demo console

Application services
  ├─ deterministic matcher with stored signals
  ├─ normalized SHA-256 content hashing
  ├─ cumulative case importer and scheduled monitor
  ├─ durable domain-event publisher and subscriber notification worker
  ├─ idempotent update checker, retry backoff, and notifications
  └─ schema-validated semantic provider + cache

Adapters                    Persistence
  ├─ Engage Ottawa parser     ├─ consultations/sources/identifiers
  ├─ Ottawa eScribe parser    ├─ relationships/events/themes/commitments
  └─ guarded live fetcher     └─ subscriptions/events/deliveries/cache (SQLite)
```

Exact identifiers and explicit official relationships establish deterministic facts. Medium-strength signals require at least two independent signals. Title similarity alone never creates a link. Semantic extraction is bounded to supplied text and cannot override deterministic IDs.

## Data provenance

The repository includes minimal representative HTML snapshots in `fixtures/`. They were derived from public City of Ottawa pages and retrieved/verified on 2026-09-26. They retain only the structure and text needed for parsing and the demo; they are not full mirrors.

Seeded official records include:

- [Field Street Sidewalk — Engage Ottawa](https://engage.ottawa.ca/field-street-sidewalk), including Engage project `37100`, widget `161486`, and document `112135`.
- [Community Garden Action Plan review — October 24, 2023](https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English), report `ACS2023-OCC-CCS-0122`.
- [Community-led Green Initiatives and Garden Program — April 30, 2025](https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English), report `ACS2025-CSS-GEN-007`; result recorded as Carried.
- [Community-garden key documents — Engage Ottawa](https://engage.ottawa.ca/community-gardens-and-community-led-green-initiatives/widgets/179619/documents).

“No public response found” means only that CivicLoop did not find a response in checked sources. It does not claim the City took no action.

## Semantic providers

Semantic extraction covers document classification, claim-level plain-language summaries, project aliases, feedback-to-response mappings, response status, commitments, and ambiguous relationship assessment. Every extracted item must retain a source excerpt. Output is validated twice: first against a strict Zod/JSON schema, then against the supplied source text. Insignificant punctuation is normalized; an invented evidence span rejects the result. A near-verbatim long quote may be reduced to a grounded prefix of at least eight words, but ungrounded text is never saved. A deterministic civic glossary also prevents known interpretation errors—for example, eScribe’s `Carried` means a motion passed, not that a program was implemented.

### Gemini-first provider with local fallback

When `GEMINI_API_KEY` is configured, CivicLoop first uses `gemini-3.5-flash`. A Gemini error—including an unavailable service or exhausted quota—automatically retries the extraction with the local OpenAI-compatible server:

```text
http://127.0.0.1:8001/v1
mlx-community/Qwen3.5-9B-4bit
```

With the local server running, analyze one source first:

```bash
npm run analyze-consultation -- field-street-sidewalk --live --source=src-field-page
```

Then analyze every linked source:

```bash
npm run analyze-consultation -- field-street-sidewalk --live
```

Omit `--live` to analyze saved source text. Results are cached by meaningful content hash + schema version + provider/model chain, written to `reports/<slug>-analysis-*.{md,json}`, and integrated into the consultation page’s cited summary. Repeating the same command uses the cache and makes no model call.

Override the local endpoint/model with `CIVICLOOP_LOCAL_LLM_URL` and `CIVICLOOP_LOCAL_LLM_MODEL`.

`FixtureSemanticProvider` remains available with `--fixture` and is used by automated tests, so tests never call a model. Live browser checks, monitoring, community enrichment, and update commands use Gemini first when configured and local Qwen otherwise. Pass `--gemini` or `--local` to force a provider. Unchanged hashes still make no model call.

An optional `OpenAISemanticProvider` uses the official OpenAI SDK Responses API with structured Zod output. Set `OPENAI_API_KEY` and optionally `CIVICLOOP_LLM_MODEL`, then invoke it explicitly with:

```bash
npm run check-updates -- --openai
npm run analyze-consultation -- field-street-sidewalk --live --openai
```

Because unchanged update checks short-circuit before semantic extraction, `analyze-consultation` is the explicit way to analyze an existing document. The OpenAI provider is implemented but was **not live-tested with credentials** for this build. API keys remain server-side.

## Tests and security boundaries

The offline suite covers both parsers and known identifiers, title-only rejection, explicit-parent matching, normalization/hashing, unchanged short-circuit, changed-source event creation, repeat idempotency, failed retrieval semantics, invalid structured output, semantic caching, idempotent seed, and consultation-detail assembly.

The live-check endpoint accepts only a known consultation ID. The ingestion endpoint accepts one official URL and applies the same strict allowlist. Live fetching rejects non-HTTP schemes, non-allowlisted hosts, credentials, custom ports, private/local IPs, unsafe redirects, oversized responses, and unsupported content types. External HTML is parsed into text/metadata and is never rendered as raw HTML.

## Current limitations

- The resettable demo seeds two curated cases; additional cases accumulate from community-submitted official URLs in the active database.
- Ottawa page structure and IDs are undocumented implementation details and may change.
- The snapshots cover the verified demo trail, not every submission or attachment.
- The prototype has one SQLite-backed demo user rather than account authentication. Email and SMS deliveries are simulated; connecting a delivery provider is still required to send messages externally.
- The durable event worker runs synchronously after publication for the local demo. A production deployment should place the same event records behind a managed queue and retrying background consumer.
- `npm run monitor` provides due-time scheduling, cadence advancement, and exponential retry backoff. A production host must still keep the watch process alive or invoke the one-shot command from its scheduler.
- Imported AI findings are grounded and visible, but there is not yet a human moderation queue for approving uncertain relationships at scale.
- French/English document pairing and Development Applications remain outside this MVP.
- Gemini was credential-tested and correctly returned an exhausted-credit response for the configured project; automatic local-Qwen fallback completed the same request successfully. Fixture mode remains fully functional.
