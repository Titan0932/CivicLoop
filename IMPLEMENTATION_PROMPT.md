# Autonomous Implementation Prompt: CivicLoop

You are the lead implementation orchestrator for a hackathon project called **CivicLoop**. Work autonomously until the application is implemented, tested, documented, and demonstrable. The user intends to leave this task running unattended, so do not pause for ordinary product or technical choices. Make reasonable assumptions, record important decisions, and continue.

Treat this prompt as the authoritative, self-contained product and implementation specification. **Do not depend on access to any file from the originating task.** Everything required to implement the MVP is included below.

An additional research brief is included in this repository at:

```text
docs/civicloop-research.md
```

Read it once near the start for supporting discussion and references. This implementation prompt remains authoritative and self-contained; if the research file is unexpectedly unavailable, proceed without pausing or requesting access.

## 1. Operating mandate

Your job is to deliver a working, polished hackathon MVP—not merely a plan, mockup, architecture document, or collection of disconnected components.

Follow this loop until the definition of done is satisfied:

1. Inspect the repository and all applicable `AGENTS.md` instructions.
2. Determine the existing stack and project state.
3. Create a concise milestone plan with acceptance checks.
4. Implement one milestone at a time.
5. Run the relevant tests, lint, type checking, build, and smoke checks after every milestone.
6. Fix failures before advancing.
7. Keep a short, durable status and decision log in the repository.
8. Perform an end-to-end demo-path verification.
9. Finish with a concise report of what works, how to run it, test results, limitations, and any remaining nonessential follow-ups.

Do not stop after scaffolding. Do not claim completion based only on compilation. Exercise the actual core workflow.

### Autonomy rules

- Do not ask the user to choose libraries, colors, database details, component names, or other reversible implementation choices.
- If the repository is empty, initialize the smallest sensible application and continue.
- If credentials or secrets are unavailable, implement a fully usable fixture/demo mode and continue. Clearly document how real credentials can be added later.
- If a public website is temporarily inaccessible, use saved HTML fixtures based on the documented structures and continue. Do not block the entire build on a live network request.
- If an optional feature threatens completion, cut or simplify it and record the decision.
- Do not deploy, purchase services, send external messages, or publish data without explicit authorization.
- Do not push to a remote repository unless explicitly instructed. Local implementation and verification are authorized.
- Preserve unrelated existing work. Never discard user changes.

## 2. Token-conscious multi-agent policy

The user has limited tokens. Use subagents selectively and economically.

- The root orchestrator owns the overall plan, architecture, database contract, integration, shared files, final verification, and final response.
- Use subagents only when work can be divided into concrete, independent, bounded tasks that materially improve speed or quality.
- Use no more than **two active subagents at once** unless a clearly exceptional bottleneck justifies another.
- Prefer reusing an existing subagent with a follow-up task over spawning a new one.
- Give each subagent the minimum context necessary. Point it to exact files, interfaces, and acceptance criteria.
- Ask for concise results: changed files, decisions, test results, and blockers. Do not request essays or duplicate project summaries.
- Do not delegate trivial edits, sequential decisions, or work involving the same highly shared files.
- Avoid having multiple agents edit the same file simultaneously.
- Good delegation candidates include:
  - one source adapter and its fixtures/tests;
  - an isolated UI page or component set after interfaces are fixed;
  - parser tests or an accessibility/test review;
  - a final independent audit after implementation.
- Poor delegation candidates include:
  - deciding the core architecture in parallel;
  - multiple agents independently exploring the whole repository;
  - asking several agents for competing implementations of the same feature;
  - work that depends immediately on unfinished upstream changes.
- When the remaining work is sequential or small, continue with the root agent rather than spawning.

Prioritize tokens in this order:

1. A functioning end-to-end demo.
2. Correct data provenance and matching behavior.
3. Parser and core workflow tests.
4. Clear UX and demo reliability.
5. Documentation.
6. Optional polish.

## 3. Product summary

CivicLoop is an independent civic-transparency application that answers a simple question:

> After residents participate in a public consultation, what happened next?

Municipal consultation information is fragmented across engagement pages, feedback reports, staff reports, committee agendas, council minutes, votes, project pages, and implementation updates. A resident may submit feedback but then have no simple way to see whether it was acknowledged, whether the proposal changed, whether council approved it, what was promised, or whether implementation occurred.

CivicLoop connects those records into one evidence-backed lifecycle:

```text
Consultation
    → public feedback report
    → staff response or recommendation
    → committee/council decision
    → commitment
    → implementation update
```

The product is not merely a document summarizer. Its central value is **traceability and accountability**: linking records, explaining why they are linked, showing the public evidence, and distinguishing confirmed facts from inferred relationships.

The working analogy is a **package tracker for public decisions**.

## 4. Target users

Primary users:

- residents who participated in a municipal consultation;
- neighbourhood and community associations;
- local journalists;
- advocacy and accessibility organizations.

Secondary users:

- researchers studying public engagement;
- councillors or municipal staff who want to share project progress.

This is a public-interest transparency tool. Optimize for clarity, trust, source attribution, and accessibility—not monetization features.

## 5. Geographic and hackathon scope

The MVP targets **Ottawa, Ontario** and is intended for a Civic Technology hackathon challenge.

Do not attempt to support every municipality. Design adapters cleanly enough that another municipality could be added later, but implement and demonstrate Ottawa only.

Use two or three curated, verified case studies:

1. **Field Street Sidewalk** — the clearest feedback-to-design-change example.
2. **Community Garden Action Plan / Community-led Green Initiatives and Garden Program** — the best example of one initiative changing names across its lifecycle.
3. **Alexander Community Centre Expansion** — a multi-year consultation-to-funding-and-design example.

If live-source reliability or time is limited, make the first two complete and treat the third as optional enrichment.

## 6. Primary user experience

### 6.1 Dashboard

The home page should immediately explain the product and show tracked consultations.

Include:

- a concise value statement;
- consultation cards or rows;
- current lifecycle stage;
- topic and location/ward where available;
- date of the latest confirmed update;
- “last checked” status;
- whether the record is based on explicit or inferred links;
- filters for topic, lifecycle status, and optionally ward;
- a simple search;
- a small analytics summary.

Avoid a generic admin-dashboard appearance. The interface should feel like a trustworthy public-interest product.

### 6.2 Consultation detail page

This is the core demo page. Include:

- title and known aliases;
- a plain-language summary;
- current lifecycle status;
- an evidence-backed timeline;
- a “What residents said / What happened” section;
- commitments and their status;
- source documents with dates, document types, identifiers, and original links;
- an explanation of why linked documents are believed to concern this consultation;
- confidence labels such as **Verified**, **Strong match**, or **Needs review**;
- last checked and last changed timestamps;
- a manual **Check for updates** action.

Every important factual claim should be traceable to a source. A user should be able to open the original municipal record.

### 6.3 Feedback-to-response view

Represent major public feedback themes and the municipal response. Suggested statuses:

- **Addressed** — the source explicitly shows a corresponding change or action.
- **Partially addressed** — only part of the concern was acted on.
- **Declined** — the government explicitly chose not to adopt it and preferably explained why.
- **Acknowledged** — mentioned without a clear action.
- **No public response found** — CivicLoop did not find a response in the checked public sources.

Do not equate “no public response found” with “the government did nothing.” Use careful wording.

### 6.4 Analytics

Keep analytics objective and modest. Useful examples:

- number of tracked consultations by lifecycle stage;
- time from consultation close to results publication;
- time from results publication to formal decision;
- number of commitments completed, in progress, overdue, or unknown;
- consultations for which no results report was found;
- days since the latest public update.

Do not create a subjective “government listened 73%” score. Do not imply that consultation participants represent the entire population.

### 6.5 Following and notifications

For the MVP, a user should be able to follow a consultation or topic locally without building a full authentication or email system. Local browser persistence is acceptable.

Show an in-app notification or update-feed concept when a tracked consultation receives a new event. Real email, SMS, or push delivery is outside the required scope.

## 7. Ottawa source map

Use official municipal sources as the source of truth.

### 7.1 Engage Ottawa

Discovery page:

```text
https://engage.ottawa.ca/projects
```

Relevant case studies:

```text
https://engage.ottawa.ca/field-street-sidewalk
https://engage.ottawa.ca/alexander-community-centre
https://engage.ottawa.ca/zoning
https://engage.ottawa.ca/the-new-official-plan
```

Engage Ottawa can provide:

- canonical project title and page slug;
- description and affected area;
- consultation opening and closing dates;
- project/news updates;
- surveys and public meeting information;
- attached drawings and presentations;
- What We Heard, What We Learned, or As We Heard It reports;
- explicit statements about changes following public feedback.

Technical research found server-rendered identifiers on tested pages:

- the site currently used `site_id=406`;
- each tested project exposed a numeric `page_id`;
- content areas had widget IDs;
- attached files had document IDs;
- document pages exposed `data-project-id`, `data-widget-id`, and `data-document-id` together;
- downloads were available through the document page's `/download` route.

Example relationship:

```text
/37100/widgets/161486/documents/112135
```

This means document `112135` belongs to widget `161486` under project `37100`. Treat these as useful but undocumented implementation details, not a guaranteed public API contract.

### 7.2 Ottawa eScribe meeting portal

Portal guide:

```text
https://ottawa.ca/en/city-hall/council-committees-and-boards/agendas-minutes-and-videos/using-citys-agendas-and-minutes-web-portal
```

Community-garden initiating record:

```text
https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English
```

Community-garden later decision:

```text
https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English
```

The tested server-rendered pages exposed:

- meeting UUIDs in URLs;
- agenda item numbers and structured agenda-item classes;
- ACS staff-report numbers;
- attachment relationships;
- filestream document IDs;
- motion text and results such as `Carried`;
- embedded bookmark data mapping agenda items to meeting-video start times.

These fields should support an MVP parser. Their long-term stability is not guaranteed.

### 7.3 Development Applications Search

```text
https://devapps.ottawa.ca/en/applications/
```

Planning and development records can use identifiers such as:

```text
D01-01-20-0010
D07-12-22-0168
D02-02-24-0024
PC2023-0061
```

Implementing this source adapter is optional unless it is straightforward after the core two adapters. Preserve an adapter interface that makes it possible later.

### 7.4 Additional official sources

The system may link to:

- `ottawa.ca` project pages;
- `documents.ottawa.ca` files;
- `webcast.ottawa.ca/plan/` planning documents;
- City budget pages;
- Open Ottawa datasets.

Search engines, councillor newsletters, news articles, and community sites may help discover records, but they should not be treated as authoritative evidence for official status, decisions, or commitments.

## 8. Document identity and matching

There is no single universal Ottawa consultation ID. Different systems identify different objects:

- Engage Ottawa `page_id` → one engagement project page;
- widget/document IDs → content or attachments under that project;
- development application number → a planning application;
- ACS number → one specific staff report;
- eScribe meeting UUID → one meeting;
- agenda item number → one item within a meeting;
- filestream document ID → one attachment;
- by-law or motion number → one formal action.

CivicLoop must create its own stable internal consultation ID and store evidence-backed relationships to these external records.

### 8.1 Why titles are insufficient

Titles can change. The same community-garden initiative appeared first as **Community Garden Action Plan Review** and later as **Community-led Green Initiatives and Garden Program**.

Store title aliases, but never automatically merge projects from title similarity alone.

### 8.2 Strong matching evidence

Potentially sufficient for an automatic verified relationship, after validation:

- a direct official hyperlink from one record to another;
- the same planning/development application number;
- an explicit Engage Ottawa parent project/widget/document relationship;
- an eScribe agenda-item/attachment relationship;
- an exact unique formal identifier referring to the same object;
- explicit language such as “this report responds to the consultation”;
- an exact unique address or precisely defined project corridor plus compatible context.

Important: an identical ACS number establishes that two records refer to the same staff report. It is not a universal project identifier, and a long-running initiative can accumulate several ACS numbers.

### 8.3 Medium-strength evidence

Require at least two independent signals, and label the relationship as inferred or reviewable:

- similar titles or known aliases;
- same facility, park, street, or neighbourhood;
- same department or project manager;
- same ward;
- compatible chronology;
- matching distinctive description;
- results report attached to a later staff report.

### 8.4 Weak evidence

Never use these alone:

- broad topic keywords;
- same year;
- same municipal department;
- generic names such as “What We Heard”;
- title similarity without supporting location, date, link, or identifier evidence.

### 8.5 Suggested matching result

Persist not only the relationship but the reason for it:

```json
{
  "relationshipType": "results_report_for",
  "confidence": 0.94,
  "confidenceLabel": "verified",
  "signals": [
    {
      "type": "official_attachment_relationship",
      "value": "Agenda item 63 attachment DocumentId 254336"
    },
    {
      "type": "explicit_text_reference",
      "value": "Report follows the public consultation"
    }
  ],
  "humanVerified": true
}
```

Do not hard-code confidence numbers that create false precision. A simple explainable scoring scheme is acceptable:

- verified direct link or exact strong relationship → automatically link as verified;
- multiple independent medium signals → inferred/strong match, review suggested;
- title/topic similarity alone → do not link automatically.

## 9. LLM-assisted parsing

Use a hybrid system. Deterministic parsing should establish exact facts; an LLM should help interpret ambiguous prose.

### 9.1 Deterministic extraction responsibilities

Use ordinary code and parsers for:

- URLs and direct links;
- Engage Ottawa project, widget, and document IDs;
- eScribe meeting IDs, item numbers, attachment relationships, and motion results;
- ACS numbers;
- development application numbers;
- dates, addresses, wards, departments, and contact names when explicitly labelled;
- document hashes and change detection.

### 9.2 LLM responsibilities

Use an LLM only where semantic interpretation adds value:

- classify a document as consultation notice, feedback report, staff report, decision, or implementation update;
- identify likely title aliases;
- extract major feedback themes;
- extract the corresponding municipal response;
- classify a response as addressed, partial, declined, acknowledged, or no response found;
- extract commitments, responsible owner, target date, and current evidence;
- assess an ambiguous candidate relationship using a bounded set of evidence;
- generate a short plain-language summary grounded in supplied text.

### 9.3 LLM safety and cost constraints

- Use structured JSON output validated against a schema.
- Include supporting excerpts or source-span references for every extracted claim.
- Never allow the model to invent URLs, identifiers, dates, decisions, or causal claims.
- Do not let the model browse the open web as part of every classification. Feed it a bounded candidate document and extracted metadata.
- Cache results by source-document content hash, prompt/schema version, and model identifier.
- Call the LLM only when a source is new or its meaningful content changed.
- Never call a paid LLM from automated tests.
- Avoid unbounded retries and batch sizes.
- Provide a clean provider interface and a deterministic fixture/mock implementation.
- If no API key is present, the application must still run, demonstrate the full UI, and explain that semantic results came from verified demo fixtures.
- Prefer accuracy and explicit uncertainty over aggressive automatic linking.

An acceptable structured result resembles:

```json
{
  "documentType": "consultation_results",
  "projectAliases": [
    "Community Garden Action Plan Review",
    "Community-led Green Initiatives and Garden Program"
  ],
  "relationship": "results_report_for",
  "confidenceLabel": "strong_match",
  "feedbackThemes": [
    {
      "theme": "Need for clearer access and eligibility rules",
      "responseStatus": "addressed",
      "evidence": {
        "sourceDocumentId": "...",
        "excerpt": "..."
      }
    }
  ]
}
```

If OpenAI is used as the LLM provider, use the currently supported official SDK and structured-output mechanism available in the environment. Keep model configuration in environment variables rather than hard-coding an expensive model. Do not expose secrets to the browser.

## 10. Update detection

The production concept uses scheduled polling because these municipal sources do not provide one confirmed universal webhook.

For the hackathon MVP, implement:

- manual **Check for updates** from a consultation page;
- a reusable command or job entry point that checks all due sources;
- meaningful-content normalization and hashing;
- no LLM call when the content hash has not changed;
- idempotent processing so repeated checks do not create duplicate events;
- a check-run record containing outcome, timestamps, error, and change status;
- a clear visual distinction between “checked with no change,” “new update found,” and “check failed.”

The conceptual flow is:

```text
Scheduled or manual check
        → fetch allowed source
        → normalize meaningful content
        → calculate content hash
        → unchanged: record successful check only
        → changed: parse, match, extract, persist event
        → surface update to followers
```

Suggested future cadence, which should be documented but does not require a production scheduler:

- open or recently closed consultations: daily;
- items approaching a committee/council meeting: daily;
- active implementation projects: once or twice per week;
- old or completed projects: weekly or monthly;
- failures: retry with increasing delay.

Design and persist at least:

- `sourceUrl`;
- `firstSeenAt`;
- `lastCheckedAt`;
- `lastChangedAt`;
- `contentHash`;
- `nextCheckAt`;
- `checkFrequency` or cadence;
- `lastCheckStatus`;
- `consecutiveErrors`.

Do not build a complicated distributed queue, webhook platform, email pipeline, or production scheduler for the MVP. A command such as `npm run check-updates`, plus the manual UI action and documented scheduling instructions, is sufficient.

## 11. Source-fetching constraints

Implement source fetching defensively:

- allowlist the intended official Ottawa hosts;
- do not create an arbitrary URL-fetching endpoint;
- set timeouts and reasonable response-size limits;
- use a descriptive user agent where appropriate;
- rate-limit and avoid concurrent hammering;
- respect applicable robots rules and terms;
- validate content types;
- sanitize all external HTML before displaying anything;
- store extracted text or safe metadata rather than rendering raw external HTML;
- record retrieval time and original URL;
- handle redirects intentionally;
- prevent server-side request forgery by rejecting private/local network destinations and non-HTTP(S) schemes;
- distinguish retrieval failure from “no government update.”

## 12. Suggested data model

Use equivalent names if the existing repository has conventions, but preserve these concepts.

### Consultation

- internal stable ID;
- canonical title;
- known aliases;
- slug;
- summary;
- topic;
- ward/location;
- responsible department;
- opening and closing dates;
- current lifecycle status;
- latest confirmed update date.

### SourceDocument

- internal ID;
- consultation relationship if established;
- source URL and canonical URL;
- title;
- document type;
- publisher/source system;
- publication or meeting date;
- raw external identifiers stored structurally;
- extracted text or fixture reference;
- content hash;
- first seen, last checked, and last changed dates;
- retrieval status.

### ExternalIdentifier

- source document or consultation ID;
- identifier type, such as `engage_page_id`, `engage_widget_id`, `engage_document_id`, `acs_report_number`, `development_application_number`, `escribe_meeting_uuid`, `agenda_item_number`, `filestream_document_id`, `bylaw_number`, or `motion_number`;
- value;
- source URL.

### DocumentRelationship

- source record;
- target record;
- relationship type;
- confidence label;
- matching signals/evidence;
- deterministic or LLM-assisted origin;
- human verification status.

### TimelineEvent

- consultation ID;
- event type;
- title and plain-language description;
- event date;
- lifecycle stage;
- source-document references;
- confirmed/inferred status.

### FeedbackTheme

- consultation ID;
- theme;
- optional summary;
- response status;
- municipal response;
- feedback evidence source;
- response evidence source;
- verification status.

### Commitment

- consultation ID;
- promised action;
- responsible owner;
- target date;
- status;
- latest status date;
- evidence source.

### CheckRun

- source or consultation checked;
- start/end timestamps;
- status;
- old and new hash;
- whether a change was found;
- error category/message;
- number of new events/documents.

### Follow/Subscription

- local user/session identifier;
- consultation, topic, or ward followed;
- created date.

Avoid premature authentication and multi-tenancy unless already present in the repository.

## 13. Technical direction

First respect an existing coherent stack. If the repository is blank, prefer a compact TypeScript full-stack implementation that can run locally with minimal setup. A reasonable default is:

- Next.js with the App Router;
- TypeScript in strict mode;
- accessible component primitives and a small styling system such as Tailwind;
- SQLite for a self-contained local demo, using a lightweight typed ORM if helpful;
- server-side route handlers or server actions for data operations;
- a small HTML parser such as Cheerio for adapters;
- a schema validator such as Zod;
- unit/integration tests with the stack's standard lightweight runner;
- browser-level smoke testing if supported without disproportionate setup.

This is a preference, not permission to rewrite a working repository. If an existing stack already solves these needs, use it.

Keep the architecture simple:

```text
UI
  ├── consultation queries
  ├── manual update action
  └── follow state

Application services
  ├── consultation timeline builder
  ├── candidate matcher
  ├── semantic extraction service
  └── update checker

Source adapters
  ├── Engage Ottawa
  ├── Ottawa eScribe
  └── fixture/generic adapter

Persistence
  ├── consultations and sources
  ├── evidence relationships
  ├── events/themes/commitments
  └── check runs and cache
```

Define stable adapter and LLM-provider interfaces. Do not construct a microservice architecture.

## 14. Demo data and provenance

The demo must be reliable even if municipal websites are down during judging.

- Fetch and save small, legally reasonable HTML/text fixtures for the exact source pages needed by parser tests, or create minimal representative fixtures derived from observed public structure.
- Keep the original source URL and retrieval date with every fixture.
- Do not copy unnecessary personal information.
- Do not make up consultation outcomes.
- If a fact cannot be verified, omit it or label it clearly as illustrative demo data.
- Seed the database idempotently.
- Ensure a fresh developer can reset and reseed the demo safely.
- The UI should identify when it is showing a saved snapshot rather than a fresh live fetch.

At least one case study must clearly demonstrate:

1. multiple documents from different stages;
2. the evidence used to connect them;
3. at least one feedback theme;
4. the corresponding response or lack of a found response;
5. a decision or implementation event;
6. a working source link.

The community-garden case must demonstrate that title changes do not defeat matching.

## 15. MVP scope priorities

### P0: Required

- App runs locally from documented commands.
- Database/schema and repeatable seed path.
- Dashboard with tracked consultations.
- Consultation detail page with evidence-backed timeline.
- Source-document list with original links and identifiers.
- Feedback-to-response display.
- At least Engage Ottawa and eScribe adapter/parser modules or convincing fixture-backed implementations.
- Explainable deterministic matching.
- LLM-provider interface, structured schema, caching contract, and fixture/mock implementation.
- Real LLM integration if credentials and time permit, without making the demo depend on it.
- Manual update check.
- Content hashing and unchanged-page short circuit.
- Idempotent event creation.
- Core tests, lint, type checking, and production build.
- README with setup, architecture, demo steps, and limitations.

### P1: Strong additions

- Real live fetch for allowlisted sources.
- Topic/status filters and search.
- Local follow/subscription state.
- Small analytics view.
- Check-run history in the UI.
- Responsive and accessible interface.
- One end-to-end smoke test.

### P2: Only if core work is complete

- Development Applications adapter.
- Video timestamp links.
- Additional consultation examples.
- Export/share view.
- More advanced charts.
- Document translation pairing.

## 16. Explicit non-goals

Do not spend the hackathon build on:

- supporting every municipality;
- crawling the entire City of Ottawa website;
- production authentication or user accounts;
- email, SMS, or push delivery;
- a distributed job queue;
- production deployment infrastructure;
- sophisticated sentiment analysis;
- subjective government performance scores;
- automatically asserting political causality;
- replacing official municipal sources;
- a general-purpose search engine;
- a chat interface as the main product;
- elaborate animations that do not improve comprehension;
- perfect extraction from every PDF format.

## 17. UX and visual requirements

- Use a clean, calm, civic-oriented visual language.
- Prioritize readable typography, strong information hierarchy, and plain language.
- Do not imitate a generic corporate analytics dashboard.
- Use color carefully for lifecycle and response states; never rely on color alone.
- Every status needs a text label.
- Provide visible focus states and keyboard-accessible controls.
- Meet reasonable contrast requirements.
- Make source citations visually prominent rather than burying them.
- Show uncertainty honestly.
- Make the main demo legible on a laptop projector.
- Ensure mobile layout remains usable, though desktop demo quality is the priority.

## 18. Recommended repository documents

Create and maintain concise versions of:

- `PLAN.md` — milestones, acceptance criteria, and validation commands;
- `STATUS.md` — completed/current/next work, known issues, and latest verification results;
- `DECISIONS.md` — only material architectural or product choices and their reasons;
- `README.md` — setup, environment variables, commands, architecture, data provenance, demo walkthrough, tests, and limitations.

Keep these useful but short. Do not spend substantial tokens repeatedly rewriting documentation while core code remains incomplete.

## 19. Milestone plan

Adapt filenames and exact commands to the repository, but use this order.

### Milestone 0: Inspect and freeze the implementation plan

- Inspect repository state, instructions, available runtimes, and existing dependencies.
- Choose the minimum viable stack.
- Record architecture and scope decisions.
- Define exact validation commands.
- Establish a clean runnable skeleton.

Acceptance:

- development server starts;
- lint/typecheck baseline runs;
- plan and status files exist;
- no unresolved architectural choice blocks implementation.

### Milestone 1: Domain model, persistence, and seed data

- Implement the core data model.
- Add migrations or schema initialization.
- Add idempotent seed/reset commands.
- Seed two or three verified consultations and their evidence graph.

Acceptance:

- fresh setup creates the database;
- reseeding does not duplicate records;
- core query tests pass;
- provenance URLs and identifiers are present.

### Milestone 2: Dashboard and consultation detail UX

- Build the main dashboard.
- Build the evidence-backed consultation page.
- Display timeline, feedback/response, commitments, source documents, confidence, and last checked state.

Acceptance:

- all seeded consultations render;
- source links are usable;
- title aliases are visible for the community-garden case;
- empty/unknown states are expressed carefully;
- responsive and keyboard checks pass at a reasonable level.

### Milestone 3: Source adapters and deterministic matching

- Implement the source-adapter interface.
- Implement and test Engage Ottawa parsing.
- Implement and test eScribe parsing.
- Extract exact identifiers and relationships.
- Implement explainable matching with evidence.

Acceptance:

- fixture parser tests pass;
- known example IDs are extracted correctly;
- title-only matches are rejected;
- the community-garden records link using stronger evidence;
- parser failure produces a controlled result, not corrupted data.

### Milestone 4: LLM-assisted extraction

- Define validated structured schemas.
- Implement mock/fixture provider.
- Implement real provider behind environment configuration if feasible.
- Add cache keys and grounded evidence requirements.
- Integrate semantic results without overriding deterministic facts.

Acceptance:

- application works without an API key;
- invalid model output is rejected safely;
- tests make no paid model calls;
- repeated unchanged input uses cached results;
- claims retain document evidence.

### Milestone 5: Update checking

- Implement manual per-consultation check.
- Implement check-all/due job entry point.
- Normalize content, hash it, detect changes, and store check runs.
- Prevent duplicate events.
- Surface results in the UI.

Acceptance:

- unchanged fixture creates no duplicate timeline event and makes no semantic call;
- changed fixture creates exactly one appropriate update;
- repeating the same changed fixture stays idempotent;
- failure is shown as a check failure, not as no public update;
- command and manual action both work.

### Milestone 6: Product polish and analytics

- Add concise analytics, filters/search, follow state, and update feed if time permits.
- Improve loading, empty, error, and offline/demo states.
- Perform accessibility and responsive review.

Acceptance:

- core workflow remains clear without explanation;
- no decorative feature hides provenance or uncertainty;
- demo remains fast and stable.

### Milestone 7: Final verification and handoff

- Run clean install/setup if practical.
- Run all tests, lint, type checking, and production build.
- Run the actual demo flow.
- Inspect the UI visually, fixing obvious layout or content problems.
- Review security boundaries around fetching and HTML display.
- Update README, status, decisions, and known limitations.

Acceptance:

- all required checks pass;
- app starts from documented commands;
- the full judge demo can be completed without live external dependencies;
- no P0 item remains unfinished;
- any P1/P2 omission is documented without presenting it as complete.

## 20. Test requirements

At minimum, test:

- Engage Ottawa ID and attachment extraction;
- eScribe meeting, item, ACS, attachment, and motion-result extraction;
- known identifier patterns;
- title-only false-positive rejection;
- direct-link/explicit-parent matching;
- content normalization and hashing;
- unchanged-source short circuit;
- changed-source event creation;
- idempotency on repeated checks;
- invalid LLM structured output;
- semantic cache behavior;
- consultation detail query/view data assembly.

Use realistic small fixtures. Do not make normal tests depend on public network availability.

If browser testing is available, cover this smoke path:

1. Open dashboard.
2. Find Community Garden case.
3. Open its detail page.
4. See the old and new titles.
5. Inspect why documents were linked.
6. Open or identify original sources.
7. Run Check for updates.
8. See a clear result without duplicate events.

## 21. Demo narrative

Build the product so the following three-minute demonstration is natural:

1. “Residents participate in consultations, but the story is scattered afterward.”
2. Show the CivicLoop dashboard and choose the community-garden initiative.
3. Show that the initiative changed names, yet CivicLoop connected the records using official links, report/meeting metadata, and attachment relationships—not title guessing.
4. Show major public feedback themes beside the documented response.
5. Show the formal decision, vote/result, commitments, and latest known implementation stage.
6. Open a source and show that the claim is verifiable.
7. Run Check for updates and explain that unchanged pages are not sent to the LLM again.
8. Show Field Street as a second case where feedback corresponded to concrete design changes.

The product should demonstrate civic value and technical substance without requiring a long explanation of its architecture.

## 22. Definition of done

The task is complete only when all of the following are true:

- A fresh user can install, initialize, seed, and run the project using the README.
- The dashboard and consultation pages are functional and polished enough for a hackathon demo.
- At least two real Ottawa case studies are represented with source provenance.
- The project shows consultation → feedback/results → decision/response → implementation or commitment where evidence exists.
- The community-garden title change is handled without relying on title equality.
- Matching reasons and uncertainty are visible.
- Manual update checking works.
- Content hashing prevents unnecessary semantic processing.
- Repeated processing is idempotent.
- The app works in fixture/demo mode without credentials or live municipal websites.
- LLM integration is bounded, schema-validated, cached, and grounded—or its provider boundary is implemented and honestly documented if credentials prevent a live integration test.
- Core tests pass.
- Lint, type checking, and production build pass.
- The actual demo flow has been exercised.
- Security and accessibility basics have been checked.
- Documentation names genuine limitations rather than hiding them.

## 23. Final response requirements

When finished, report:

1. the implemented outcome;
2. the important architectural choices;
3. the exact commands to install, seed, run, test, and check updates;
4. the demo walkthrough;
5. verification results with actual commands and outcomes;
6. whether a real LLM provider was tested or only the fixture provider;
7. which source adapters were tested against fixtures and/or live pages;
8. remaining limitations and only the most useful next steps.

Do not end with a vague statement such as “the foundation is ready.” Finish the working P0 product, verify it, and state precisely what is and is not complete.
