import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { contentHash, normalizeContent } from "./hash";

const checkedAt = "2026-09-26T14:00:00.000Z";

function fixture(name: string) {
  const fixturePath = path.join(process.cwd(), "fixtures", name);
  const raw = fs.readFileSync(fixturePath, "utf8");
  return { fixturePath, raw, text: normalizeContent(raw), hash: contentHash(raw) };
}

function upsert(db: DatabaseSync, table: string, data: Record<string, unknown>) {
  const columns = Object.keys(data);
  const values = columns.map((key) => data[key] as never);
  const updates = columns.filter((key) => key !== "id").map((key) => `${key}=excluded.${key}`).join(",");
  db.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates}`).run(...values);
}

export function seedDatabase(db: DatabaseSync, reset = false) {
  if (reset) {
    db.exec("DELETE FROM notification_deliveries; DELETE FROM domain_events; DELETE FROM consultation_subscriptions; DELETE FROM notification_preferences; DELETE FROM discovery_requests; DELETE FROM notifications; DELETE FROM semantic_cache; DELETE FROM check_runs; DELETE FROM commitments; DELETE FROM feedback_themes; DELETE FROM timeline_events; DELETE FROM relationships; DELETE FROM source_documents; DELETE FROM consultations;");
  }
  db.prepare(`INSERT OR IGNORE INTO notification_preferences
    (user_id, display_name, email, phone, in_app_enabled, email_enabled, sms_enabled, updated_at)
    VALUES ('demo-user', 'Demo user', NULL, NULL, 1, 0, 0, datetime('now'))`).run();

  const field = fixture("engage-field-street.html");
  const garden2023 = fixture("escribe-community-garden-2023.html");
  const garden2025 = fixture("escribe-community-garden-2025.html");

  const consultations = [
    {
      id: "con-field-street", slug: "field-street-sidewalk", title: "Field Street Sidewalk",
      aliases_json: JSON.stringify([]),
      summary: "A missing-link sidewalk project where public concerns about trees and drainage led to documented design revisions.",
      topic: "Walking & streets", location: "Field Street, Woodroffe Avenue to Iris Street", ward: "Ward 8 — College",
      department: "Infrastructure and Water Services", opened_at: "2023-05-24", closed_at: "2023-06-23",
      status: "implementation_underway", latest_update_at: "2023-11-01", last_checked_at: checkedAt, match_label: "verified"
    },
    {
      id: "con-community-gardens", slug: "community-led-green-initiatives", title: "Community-led Green Initiatives and Garden Program",
      aliases_json: JSON.stringify(["Community Garden Action Plan Review", "Community Garden Action Plan review and update"]),
      summary: "A city-wide review that moved from a 2023 Council direction through public consultation to an approved integrated program in 2025.",
      topic: "Parks & community", location: "City-wide", ward: null,
      department: "Recreation, Cultural and Facility Services", opened_at: "2024-01-01", closed_at: "2024-12-31",
      status: "implementation_underway", latest_update_at: "2025-04-30", last_checked_at: checkedAt, match_label: "verified"
    }
  ];
  for (const item of consultations) upsert(db, "consultations", item);

  const sources = [
    {
      id: "src-field-page", consultation_id: "con-field-street", url: "https://engage.ottawa.ca/field-street-sidewalk",
      title: "Field Street Sidewalk", document_type: "consultation_page", source_system: "Engage Ottawa", published_at: "2023-05-24",
      identifiers_json: JSON.stringify([{ type: "engage_page_id", value: "37100", sourceUrl: "https://engage.ottawa.ca/field-street-sidewalk" }]),
      extracted_text: field.text, content_hash: field.hash, first_seen_at: "2023-05-24T00:00:00.000Z", last_checked_at: checkedAt,
      last_changed_at: "2023-11-01T00:00:00.000Z", next_check_at: "2026-10-03T14:00:00.000Z", cadence: "weekly",
      check_status: "success", consecutive_errors: 0, fixture_path: field.fixturePath
    },
    {
      id: "src-field-results", consultation_id: "con-field-street", url: "https://engage.ottawa.ca/37100/widgets/161486/documents/112135",
      title: "As-We-Heard-It Report", document_type: "consultation_results", source_system: "Engage Ottawa", published_at: "2023-08-01",
      identifiers_json: JSON.stringify([
        { type: "engage_page_id", value: "37100", sourceUrl: "https://engage.ottawa.ca/37100/widgets/161486/documents/112135" },
        { type: "engage_widget_id", value: "161486", sourceUrl: "https://engage.ottawa.ca/37100/widgets/161486/documents/112135" },
        { type: "engage_document_id", value: "112135", sourceUrl: "https://engage.ottawa.ca/37100/widgets/161486/documents/112135" }
      ]),
      extracted_text: field.text, content_hash: field.hash, first_seen_at: "2023-08-01T00:00:00.000Z", last_checked_at: checkedAt,
      last_changed_at: "2023-08-01T00:00:00.000Z", next_check_at: "2026-10-26T14:00:00.000Z", cadence: "monthly",
      check_status: "success", consecutive_errors: 0, fixture_path: field.fixturePath
    },
    {
      id: "src-garden-motion", consultation_id: "con-community-gardens", url: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English",
      title: "Community Garden Action Plan review and update", document_type: "council_direction", source_system: "Ottawa eScribe", published_at: "2023-10-24",
      identifiers_json: JSON.stringify([
        { type: "escribe_meeting_uuid", value: "7981eb6b-20e7-4706-bb99-4518b591c65f", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English" },
        { type: "agenda_item_number", value: "30", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English" },
        { type: "acs_report_number", value: "ACS2023-OCC-CCS-0122", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=Agenda&Id=7981eb6b-20e7-4706-bb99-4518b591c65f&Item=30&Tab=attachments&lang=English" }
      ]),
      extracted_text: garden2023.text, content_hash: garden2023.hash, first_seen_at: "2023-10-24T00:00:00.000Z", last_checked_at: checkedAt,
      last_changed_at: "2023-10-24T00:00:00.000Z", next_check_at: "2026-10-26T14:00:00.000Z", cadence: "monthly",
      check_status: "success", consecutive_errors: 0, fixture_path: garden2023.fixturePath
    },
    {
      id: "src-garden-results", consultation_id: "con-community-gardens", url: "https://engage.ottawa.ca/community-gardens-and-community-led-green-initiatives/widgets/179619/documents",
      title: "What We Learned Report – Community Garden Action Plan Review", document_type: "consultation_results", source_system: "Engage Ottawa", published_at: "2025-04-09",
      identifiers_json: JSON.stringify([{ type: "engage_widget_id", value: "179619", sourceUrl: "https://engage.ottawa.ca/community-gardens-and-community-led-green-initiatives/widgets/179619/documents" }]),
      extracted_text: garden2025.text, content_hash: garden2025.hash, first_seen_at: "2025-04-09T00:00:00.000Z", last_checked_at: checkedAt,
      last_changed_at: "2025-04-09T00:00:00.000Z", next_check_at: "2026-10-26T14:00:00.000Z", cadence: "monthly",
      check_status: "success", consecutive_errors: 0, fixture_path: garden2025.fixturePath
    },
    {
      id: "src-garden-decision", consultation_id: "con-community-gardens", url: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English",
      title: "Community-led Green Initiatives and Garden Program — Council minutes", document_type: "council_decision", source_system: "Ottawa eScribe", published_at: "2025-04-30",
      identifiers_json: JSON.stringify([
        { type: "escribe_meeting_uuid", value: "a016f492-7ff8-4635-8186-b541536253f6", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English" },
        { type: "agenda_item_number", value: "63", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English" },
        { type: "acs_report_number", value: "ACS2025-CSS-GEN-007", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English" },
        { type: "filestream_document_id", value: "230509", sourceUrl: "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English" }
      ]),
      extracted_text: garden2025.text, content_hash: garden2025.hash, first_seen_at: "2025-04-30T00:00:00.000Z", last_checked_at: checkedAt,
      last_changed_at: "2025-04-30T00:00:00.000Z", next_check_at: "2026-10-26T14:00:00.000Z", cadence: "monthly",
      check_status: "success", consecutive_errors: 0, fixture_path: garden2025.fixturePath
    }
  ];
  for (const item of sources) upsert(db, "source_documents", item);

  const relationships = [
    { id: "rel-field-parent", source_id: "src-field-results", target_id: "src-field-page", relationship_type: "results_report_for", confidence: "verified", signals_json: JSON.stringify([{ type: "explicit_parent_relationship", value: "Document 112135 belongs to widget 161486 under Engage project 37100." }]), origin: "deterministic", human_verified: 1 },
    { id: "rel-garden-report-decision", source_id: "src-garden-results", target_id: "src-garden-decision", relationship_type: "attached_results_for", confidence: "verified", signals_json: JSON.stringify([{ type: "official_attachment_relationship", value: "The Council item attaches the What We Learned report under the renamed program." }, { type: "exact_report_identifier", value: "Council item carries ACS2025-CSS-GEN-007." }]), origin: "deterministic", human_verified: 1 },
    { id: "rel-garden-motion-decision", source_id: "src-garden-motion", target_id: "src-garden-decision", relationship_type: "initiated_program_review", confidence: "strong_match", signals_json: JSON.stringify([{ type: "explicit_text_reference", value: "The 2025 report implements the comprehensive review directed in 2023." }, { type: "distinctive_subject", value: "Both records concern community gardens and green initiatives on City-owned land." }, { type: "compatible_chronology", value: "2023 direction precedes consultation and the 2025 program decision." }]), origin: "deterministic", human_verified: 1 }
  ];
  for (const item of relationships) upsert(db, "relationships", item);

  const events = [
    { id: "evt-field-open", consultation_id: "con-field-street", event_type: "consultation_opened", title: "Public consultation opened", description: "The City held a virtual open house and invited comments on a proposed sidewalk along Field Street.", event_date: "2023-05-24", stage: "Consultation", confidence: "confirmed", source_ids_json: JSON.stringify(["src-field-page"]) },
    { id: "evt-field-results", consultation_id: "con-field-street", event_type: "results_published", title: "Survey findings published", description: "An As-We-Heard-It report summarized feedback from the survey, phone, and email channels.", event_date: "2023-08-01", stage: "Results", confidence: "confirmed", source_ids_json: JSON.stringify(["src-field-results"]) },
    { id: "evt-field-revision", consultation_id: "con-field-street", event_type: "implementation_update", title: "Design revised after public concerns", description: "The sidewalk was narrowed and shifted in one segment to reduce tree risk; tree replacement and parking changes were also documented.", event_date: "2023-11-01", stage: "Implementation", confidence: "confirmed", source_ids_json: JSON.stringify(["src-field-page"]) },
    { id: "evt-garden-direction", consultation_id: "con-community-gardens", event_type: "council_direction", title: "Council directed a comprehensive review", description: "The carried direction asked staff to review the Community Garden Action Plan and make formal recommendations covering community gardens and similar green initiatives.", event_date: "2023-11-08", stage: "Direction", confidence: "confirmed", source_ids_json: JSON.stringify(["src-garden-motion"]) },
    { id: "evt-garden-results", consultation_id: "con-community-gardens", event_type: "results_published", title: "What We Learned report attached", description: "The public-feedback report kept the earlier Community Garden Action Plan Review title and was attached to the later program report.", event_date: "2025-04-09", stage: "Results", confidence: "confirmed", source_ids_json: JSON.stringify(["src-garden-results", "src-garden-decision"]) },
    { id: "evt-garden-committee", consultation_id: "con-community-gardens", event_type: "committee_recommendation", title: "Committee recommendation carried", description: "Community Services Committee recommended formalizing and implementing an integrated city-wide program.", event_date: "2025-04-22", stage: "Decision", confidence: "confirmed", source_ids_json: JSON.stringify(["src-garden-decision"]) },
    { id: "evt-garden-council", consultation_id: "con-community-gardens", event_type: "council_decision", title: "Council approved the program", description: "Council approved all three recommendations. The recorded result was Carried.", event_date: "2025-04-30", stage: "Implementation", confidence: "confirmed", source_ids_json: JSON.stringify(["src-garden-decision"]) }
  ];
  for (const item of events) upsert(db, "timeline_events", item);

  const feedback = [
    { id: "fb-field-trees", consultation_id: "con-field-street", theme: "Protect existing trees", summary: "Residents raised concerns about the effect of the sidewalk alignment on mature trees.", response_status: "addressed", response: "The design was narrowed to 1.8 m and shifted farther into the street for part of the corridor to reduce tree risk.", feedback_source_id: "src-field-results", response_source_id: "src-field-page", verification: "verified", evidence_excerpt: "The design concept has been slightly revised in response to public concerns about the health of existing trees and storm drainage." },
    { id: "fb-field-drainage", consultation_id: "con-field-street", theme: "Storm drainage impacts", summary: "Residents asked the City to account for drainage when revising the design.", response_status: "acknowledged", response: "The update explicitly names storm drainage as a reason for revision, but the saved public text does not specify a separate drainage intervention.", feedback_source_id: "src-field-results", response_source_id: "src-field-page", verification: "verified", evidence_excerpt: "...revised in response to public concerns about the health of existing trees and storm drainage." },
    { id: "fb-garden-scope", consultation_id: "con-community-gardens", theme: "Support more forms of community greening", summary: "The review considered green initiatives beyond traditional garden plots on City-owned land.", response_status: "addressed", response: "Council expanded the program mandate and policy language to include community-led green initiatives alongside community gardens.", feedback_source_id: "src-garden-results", response_source_id: "src-garden-decision", verification: "verified", evidence_excerpt: "Expanding the existing community gardens policy statement to recognize community-led green initiatives as valuable community activities." },
    { id: "fb-garden-access", consultation_id: "con-community-gardens", theme: "Clearer, coordinated program access", summary: "Participants sought a clearer City pathway for community-led projects.", response_status: "partially_addressed", response: "Council delegated authority to develop and implement an integrated program. Operational details remain part of implementation.", feedback_source_id: "src-garden-results", response_source_id: "src-garden-decision", verification: "strong_match", evidence_excerpt: "Delegating authority ... to develop and implement a program that integrates both community-led green initiatives and community gardens." }
  ];
  for (const item of feedback) upsert(db, "feedback_themes", item);

  const commitments = [
    { id: "com-field-trees", consultation_id: "con-field-street", action: "Replace each of the two removed trees with two new trees.", owner: "City of Ottawa project team", target_date: null, status: "planned", latest_status_at: "2023-11-01", source_id: "src-field-page" },
    { id: "com-garden-program", consultation_id: "con-community-gardens", action: "Develop and implement the integrated Community-led Green Initiatives and Garden Program.", owner: "General Manager, Recreation, Cultural and Facility Services", target_date: null, status: "in_progress", latest_status_at: "2025-04-30", source_id: "src-garden-decision" },
    { id: "com-garden-policy", consultation_id: "con-community-gardens", action: "Expand the community gardens policy statement to recognize community-led green initiatives.", owner: "Recreation, Cultural and Facility Services", target_date: null, status: "in_progress", latest_status_at: "2025-04-30", source_id: "src-garden-decision" }
  ];
  for (const item of commitments) upsert(db, "commitments", item);

  return { consultations: consultations.length, sources: sources.length, events: events.length };
}
