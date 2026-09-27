# CivicLoop: Research and Product Brief

**Working title:** CivicLoop  
**Hackathon:** Hack the Hill III — Civic Technology Challenge  
**Date:** September 26, 2026  
**Status:** Promising direction; source matching and data coverage require validation

## 1. How we reached this direction

We initially explored projects built around the Presage SmartSpectra camera-vitals SDK, including stroke screening, anxiety detection during interviews, guided breathing, accessibility controls, and deep-inspiration breath-hold practice for radiotherapy. We dropped that direction because Presage works best only under narrow conditions: a stable camera, a mostly still and silent user, controlled framing and lighting, and long measurement windows. Those limitations were shaping the product rather than helping it.

Hack the Hill III allows a team to choose a main challenge, such as General, Civic Technology, CGI, or Education, while likely stacking eligible MLH sponsor challenges. We decided to stop optimizing for the Presage prize and investigate Civic Technology ideas with a real people–government connection.

The opportunity areas considered included:

- public-consultation accountability;
- council decisions and voting transparency;
- government service navigation;
- 311 service-request accountability;
- emergency resource access;
- transit accessibility;
- budgets and procurement;
- permit and civic-process navigation.

Public-consultation accountability emerged as the strongest balance of civic relevance, usefulness, feasibility, and demo potential.

## 2. The product in one sentence

> CivicLoop is a package tracker for public decisions.

It independently follows a public consultation from the moment government asks for input through the publication of results, committee and council decisions, implementation commitments, and later progress updates.

CivicLoop would not be an official government system. It would collect and organize information that is already publicly available, always linking users back to the original sources.

## 3. The problem

Information about one civic issue is often spread across several places and published months apart:

- an Engage Ottawa consultation page;
- surveys, public meetings, or presentation material;
- a “What We Heard,” “What We Learned,” or “As We Heard It” report;
- a staff report;
- a committee agenda and minutes;
- amendments and council votes;
- budget documents or procurement notices;
- a later construction or implementation update.

A resident may participate in the consultation but never learn what changed, what council decided, or whether promised work happened. The information may technically be public without being practically easy to follow.

The weak solution is to summarize documents. The stronger solution is to connect the full decision trail and make commitments traceable.

## 4. Core user experience

A resident can follow:

- a specific consultation;
- their ward or neighbourhood;
- a topic such as housing, transit, parks, cycling, accessibility, or budgeting;
- a department or committee.

Each tracked issue answers three questions:

1. What did residents ask for?
2. What did the municipality decide?
3. What has happened since the decision?

The page presents a timeline such as:

```text
Consultation opened
        ↓
Public feedback collected
        ↓
Results report published
        ↓
Committee recommendation
        ↓
Council decision and vote
        ↓
Implementation commitments
        ↓
Progress update, completion, or no public update found
```

## 5. Main features

### 5.1 Consultation tracker

Each consultation has a clear status:

- open for input;
- closed, awaiting results;
- results published;
- awaiting committee or council decision;
- approved or declined;
- implementation underway;
- completed;
- no recent public update found.

“No public update found” must not be presented as “stalled” or “abandoned.” Absence of public evidence is not proof that no work occurred.

### 5.2 What changed?

The system connects major public concerns to explicit government responses:

- **Addressed:** the plan changed in response.
- **Partly addressed:** a smaller or different change was made.
- **Explicitly declined:** government explained why it would not make the change.
- **No response found:** no public answer was located.

Every classification must include a source link and supporting passage. CivicLoop should not invent a vague “government listened 73%” score.

### 5.3 Commitment tracker

The system extracts concrete future commitments, including:

- promised action;
- responsible department or body;
- expected date;
- original source;
- latest public evidence;
- current status.

Examples include a promised report in Q2, a final design by August, procurement in October, or construction in spring 2027.

### 5.4 Subscriptions and alerts

Users can receive alerts when:

- a new relevant consultation opens;
- a deadline is approaching;
- a results report is published;
- an issue is placed on a committee agenda;
- council makes a decision;
- the plan changes after feedback;
- an implementation update appears;
- a promised date passes without a public update being found.

### 5.5 Evidence and source history

Each claim should expose:

- the official source URL;
- document title and publication date;
- the relevant text passage;
- whether the statement was directly extracted or inferred;
- matching confidence and review status.

## 6. Analytics dashboard

The dashboard should measure objective process information rather than issue a subjective score for whether government is “good” or “bad.” Possible metrics include:

- time from consultation close to results publication;
- time from consultation to committee and council decision;
- time from decision to implementation update;
- consultations with no results report found;
- projects with no public update for a selected period;
- commitments completed by their published date;
- active, decided, in-progress, completed, and unknown-status projects;
- processing times by topic, department, committee, or ward;
- percentage of major feedback themes that received an explicit response.

The product should carefully distinguish:

- **observable process delay** from poor performance;
- **missing public information** from missing internal activity;
- **consultation feedback** from representative public opinion.

## 7. Target users

- residents who participated in a consultation;
- neighbourhood and community associations;
- local journalists;
- advocacy and accessibility organizations;
- researchers studying public engagement;
- councillors and staff sharing project progress.

This is primarily a public-interest transparency product. Its civic value is stronger than its obvious commercial business model.

## 8. Ottawa source map

### 8.1 Engage Ottawa

Likely starting point for discovering consultations and their basic lifecycle.

Useful information includes:

- canonical project title and page slug;
- project description and affected area;
- consultation opening and closing dates;
- page update dates;
- project manager or departmental contact;
- surveys and public-meeting information;
- attached drawings and presentations;
- “What We Heard,” “What We Learned,” and “As We Heard It” reports;
- news-feed updates and links to newer City pages;
- explicit statements that a design changed after public feedback.

Observed examples:

- **Field Street Sidewalk** contains the consultation dates, the feedback report, a later status update, and an explicit list of design changes made in response to concerns.
- **Alexander Community Centre Expansion** records consultations in 2020, 2021, and 2026, participant counts, a 2021 results report, later budget funding, and a design-phase update.
- **New Zoning By-law** records multiple consultation phases, council approval, enactment, and later appeal information.
- **Official Plan** includes a formal file number and notice of decision.

Technical inspection of several Engage Ottawa pages found useful structured identifiers in the server-rendered HTML:

- the overall Engage Ottawa site currently identifies itself with `site_id=406`;
- each tested project has a numeric `page_id`, such as `37100` for Field Street Sidewalk, `12522` for Alexander Community Centre, and `28126` for the New Zoning By-law;
- content areas have widget IDs;
- attached files have document IDs;
- document pages expose their `data-project-id`, `data-widget-id`, and `data-document-id` together;
- the downloadable file is available through the document page's `/download` route.

For example, the Field Street “As We Heard It” document is part of a URL hierarchy resembling:

```text
/37100/widgets/161486/documents/112135
```

This gives CivicLoop a much stronger relationship than title similarity: document `112135` belongs to widget `161486` within project `37100`. These IDs appear suitable for a hackathon prototype, although they are implementation details rather than a publicly documented API contract and could change in the future.

### 8.2 Ottawa eScribe meeting portal

Source for formal municipal decisions:

- committee and council agendas;
- agenda-item numbers;
- staff reports and attachments;
- motions and amendments;
- recommendations;
- vote results;
- meeting dates and stages;
- post-meeting minutes;
- video links or timestamps where available.

eScribe meeting URLs contain stable-looking meeting UUIDs and item numbers, but these are identifiers for the meeting record, not necessarily the underlying public project.

Technical inspection also found that the meeting pages are server-rendered and contain useful structure without requiring a browser-only scraper. The tested page exposed:

- a meeting UUID in the URL;
- an agenda item number and internal agenda-item relationship;
- a visible ACS report number;
- attachment relationships tied to the agenda item;
- filestream document IDs for each attachment;
- motion text and a machine-readable-looking `MotionResult`, such as `Carried`;
- embedded bookmark data that maps agenda items to meeting-video start times.

For the Community-led Green Initiatives and Garden Program, the final agenda item connects the staff report and the English and French “What We Learned” attachments even though the initiative's title changed from its earlier name. This structure is sufficient for a small prototype parser. The long-term stability of these undocumented HTML fields still needs testing.

### 8.3 Staff reports and attachments

Staff reports are especially valuable because they often connect the consultation, public findings, recommendations, financial implications, responsible department, and next steps.

Ottawa council report numbers follow patterns such as:

```text
ACS2025-CSS-GEN-007
ACS2023-OCC-CCS-0122
ACS2021-PIE-GEN-0004
```

An ACS report number is a strong identifier for that particular report. A single long-running issue may have several ACS numbers over time, so it is not a universal project ID.

### 8.4 Development Applications Search

For planning and development consultations, Ottawa exposes application numbers such as:

```text
D01-01-20-0010
D07-12-22-0168
D02-02-24-0024
PC2023-0061
```

These are among the strongest cross-document identifiers. They often appear in application pages, PDF filenames, consultation notices, supporting studies, email instructions, and later reports.

The Development Applications Search also supports searches by address, street name, and application number and offers a bulk download of development-application data.

### 8.5 City project pages and document storage

Relevant material may also appear on:

- `ottawa.ca` project pages;
- `documents.ottawa.ca` PDFs;
- `webcast.ottawa.ca/plan/` planning documents;
- City budget and procurement pages;
- Open Ottawa datasets;
- department-specific dashboards.

### 8.6 Secondary discovery sources

Search engines, councillor newsletters, community-association pages, and news coverage can help discover official records. They should not replace official sources for status, decisions, or commitments.

## 9. How to know whether two documents concern the same consultation

Titles are useful clues, but they are not reliable identifiers. Titles can change between consultation, staff-report, and council stages. For example, “Community Garden Action Plan Review” later became “Community-led Green Initiatives and Garden Program.”

Matching should use a combination of signals.

### 9.1 Strong matching signals

One strong signal may be sufficient, subject to validation:

- the same development/application/file number;
- the same ACS report number;
- a direct link from one official document to another;
- the same eScribe agenda-item or attachment relationship;
- an Engage Ottawa document's explicit parent project and widget IDs;
- an eScribe meeting UUID, agenda-item number, and filestream document relationship;
- an explicit phrase such as “this report responds to” or “following the consultation”;
- the same unique street address or defined project corridor;
- a formal by-law, motion, or inquiry number.

### 9.2 Medium-strength signals

Use two or more together:

- substantially similar project titles;
- same facility, park, street, or neighbourhood name;
- same responsible department and project manager;
- same ward;
- compatible dates and expected lifecycle order;
- shared unusual phrases;
- matching project description or policy subject;
- the results report appearing as an attachment to a later staff report.

### 9.3 Weak signals

Never use these alone:

- broad keywords such as “housing,” “transit,” or “park”;
- the same year;
- the same department;
- generic report names such as “What We Heard”;
- title similarity without matching location, dates, or identifiers.

## 10. Proposed matching workflow

1. **Start with one trusted consultation page.**  
   Treat its URL as the seed record.

2. **Extract the consultation fingerprint.**  
   Save title, aliases, page slug, dates, location, address, ward, department, contacts, file numbers, report numbers, and every linked attachment.

3. **Follow direct official links first.**  
   These are safer than broad web search results.

4. **Search official systems using strong identifiers.**  
   Query the ACS number, development application number, exact address, or distinctive title on Ottawa/eScribe domains.

5. **Create candidate links.**  
   Assign evidence such as shared ID, linked attachment, title similarity, shared address, and chronological fit.

6. **Calculate a matching confidence.**  
   Example rule:
   - verified direct link or identical strong ID: high confidence;
   - two or more independent medium signals: review suggested;
   - only title or topic similarity: do not link automatically.

7. **Require review for political claims.**  
   A person should confirm links used to state that public feedback caused a decision or that a commitment was missed.

8. **Store the evidence for the link.**  
   The database should record why two documents were connected, not merely that they were connected.

## 11. Suggested data model

### Consultation

- internal CivicLoop ID;
- title and known aliases;
- seed URL;
- topic, ward, location, and responsible department;
- opening and closing dates;
- current lifecycle status.

### Source document

- URL, title, document type, date, publisher;
- ACS number, application number, by-law number, or other identifiers;
- extracted text and checksum;
- first-seen and last-checked dates.

### Relationship

- source record A;
- source record B;
- relationship type;
- matching signals;
- confidence;
- human verification status.

### Event

- consultation opened or closed;
- report published;
- committee discussion;
- council decision;
- amendment or vote;
- implementation update;
- completion.

### Feedback theme and response

- public concern or request;
- response status;
- government response;
- source evidence;
- reviewer status.

### Commitment

- promised action;
- responsible owner;
- target date;
- completion evidence;
- latest status.

### Subscription

- followed consultation, topic, ward, or location;
- notification preferences;
- last notification state.

## 12. Hackathon MVP

Use two or three manually verified Ottawa case studies rather than attempting to crawl the entire municipality.

Recommended MVP:

1. Browse a small list of consultations.
2. Open a consultation timeline.
3. See “what residents said” versus “what changed.”
4. View official evidence for every statement.
5. Follow a consultation or topic.
6. Display a small analytics dashboard.
7. Demonstrate detection of a new update or an expected update with no public record found.

Good candidate cases:

- **Field Street Sidewalk:** compact, concrete feedback-to-design changes and a later project page.
- **Community Garden Action Plan Review:** clear motion, consultation report, later staff recommendation, committee/council decision, and multiple strong report IDs.
- **Alexander Community Centre Expansion:** multi-year lifecycle from consultation to funding and detailed design.

The community-garden case is the best test of document matching because its title changed over time while its official reports and meeting trail preserve stronger links.

## 13. Technical and product risks

- Some interactions depend on JavaScript, but the tested Engage Ottawa and eScribe records also expose substantial server-rendered HTML. A prototype can parse that HTML; production reliability remains uncertain because the fields are not a documented public API.
- Attachments can move or be duplicated under different document IDs.
- English and French versions may look like separate records.
- A long-running project can change names and accumulate several report numbers.
- One consultation page can contain several consultation rounds.
- A staff report may combine multiple projects.
- Publication dates and meeting dates are not always the same.
- Search-engine results can be stale or incomplete.
- Automatically deciding that feedback caused a policy change is risky.
- “No update found” can reflect a crawler failure rather than a missing government update.
- Municipality-wide comparison may be unfair when different project types naturally have very different timelines.

## 14. Open research questions

### 14.1 Questions answered or partly answered by this research

1. **Does Engage Ottawa provide usable structured data?**  
   No documented public API was confirmed. However, the tested pages are server-rendered and expose project, widget, and document IDs plus explicit parent relationships. That is enough for a hackathon prototype.

2. **Can an attached document be tied to the right Engage Ottawa consultation?**  
   Yes, on the tested pages. The document page carries its project, widget, and document IDs. CivicLoop should save all three rather than infer the connection from a filename.

3. **Can eScribe be parsed without image recognition or a fully manual process?**  
   Yes, on the tested records. Its HTML contains agenda-item structure, report numbers, attachment IDs, motion results, and video bookmark data. No documented public API was confirmed.

4. **Are titles the same throughout a consultation's lifecycle?**  
   No. The community-garden example changed from “Community Garden Action Plan Review” to “Community-led Green Initiatives and Garden Program.” Title aliases should be stored, but titles should not be the primary join key.

5. **Is there one universal Ottawa consultation ID?**  
   No such identifier was found. Different systems identify different objects: an Engage Ottawa project, a development application, a staff report, a meeting, an agenda item, or an attachment. CivicLoop's main technical job is to link these records with evidence.

### 14.2 Questions still open

These should be investigated before treating the crawler as production-ready:

1. How stable are Engage Ottawa's undocumented page, widget, and document IDs over redesigns or platform migrations?
2. How stable are eScribe meeting UUIDs, item numbers, filestream document IDs, and HTML class names?
3. Can English and French documents be automatically recognized as translations of the same source?
4. Which consultation types consistently produce a What We Heard/Learned report?
5. How often does the results report become an attachment to the final staff report?
6. Can the Development Applications bulk download be used without authentication and how often is it updated?
7. Are City project and procurement pages searchable by ACS or development application number?
8. What minimum evidence should be required before labelling feedback addressed, declined, or unanswered?
9. How should repeated consultation rounds under one project be represented?
10. What is the crawler's false-link and missed-link rate on a manually labelled sample?

## 15. Current assessment

| Criterion | Assessment |
|---|---|
| Civic Technology fit | Very strong |
| Ottawa relevance | Very strong |
| Public value | Strong |
| Global novelty | Moderate to low; accountability platforms already exist |
| Local differentiation | Strong if it connects existing systems without government adoption |
| Hackathon feasibility | Strong with two or three curated cases |
| Technical risk | Moderate, mainly document discovery and entity matching |
| Demo potential | Strong if it reveals a real feedback-to-decision trail |

The project is valuable if it functions as an independent accountability layer. It becomes shallow if it only summarizes PDFs. The core technical and civic contribution should be the evidence-backed connection between consultation, response, decision, commitment, and outcome.

## 16. Key references

- [Engage Ottawa — all projects](https://engage.ottawa.ca/projects)
- [Field Street Sidewalk consultation](https://engage.ottawa.ca/field-street-sidewalk)
- [Alexander Community Centre Expansion](https://engage.ottawa.ca/alexander-community-centre)
- [New Zoning By-law](https://engage.ottawa.ca/zoning)
- [Official Plan project and formal file number](https://engage.ottawa.ca/the-new-official-plan)
- [Ottawa agendas and minutes portal guide](https://ottawa.ca/en/city-hall/council-committees-and-boards/agendas-minutes-and-videos/using-citys-agendas-and-minutes-web-portal)
- [Community Garden Action Plan initiating motion](https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English)
- [Community-led Green Initiatives and Garden Program decision](https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English)
- [Ottawa Development Applications Search](https://devapps.ottawa.ca/en/applications/)
- [Decidim accountability component](https://docs.decidim.org/en/develop/admin/components/accountability.html)
