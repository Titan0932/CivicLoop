import { describe, expect, test } from "vitest";
import { createMemoryDb } from "@/lib/db";
import { reconcileDocumentedResponses } from "@/lib/feedback-reconciliation";
import { deriveProjectHistory, materializeProjectHistory } from "@/lib/project-history";
import { seedDatabase } from "@/lib/seed";

const projectText = `
Update – January 16, 2026 Funding secured and design phase underway. Full funding for the expansion has been secured through the 2026 City budget and the project entered detailed design.
In the spring of 2020, the City of Ottawa conducted a survey on how the centre could be renovated and improved.
The second survey was open for 9 weeks from June 1, 2021 to August 5, 2021.
A public information session will be held on February 19, 2026. An online public survey will be available from February 12, 2026, to March 6, 2026.
`;

describe("project history and feedback reconciliation", () => {
  test("derives dated official milestones without adding tracker activity", () => {
    const events = deriveProjectHistory(projectText);
    expect(events.map((event) => event.eventDate)).toEqual(expect.arrayContaining(["2020", "2021-06-01", "2026-01-16", "2026-02-12", "2026-02-19"]));
    expect(events.some((event) => /tracking|demo/i.test(event.title))).toBe(false);
  });

  test("materialization is idempotent", () => {
    const db = createMemoryDb(); seedDatabase(db);
    expect(materializeProjectHistory(db, "con-field-street", "src-field-page", projectText)).toBeGreaterThan(0);
    expect(materializeProjectHistory(db, "con-field-street", "src-field-page", projectText)).toBe(0);
  });

  test("pairs a preferred option with matching feedback instead of claiming no response", () => {
    const db = createMemoryDb(); seedDatabase(db);
    db.prepare("UPDATE source_documents SET extracted_text = ? WHERE id = 'src-field-page'").run("The consultants reviewed all the feedback and based on the information Option 3 came forward as the preferred option. Option 3 provides the largest kitchen with access to the outdoor courtyard, a teen lounge and separate computer area.");
    db.prepare(`INSERT INTO feedback_themes
      (id, consultation_id, theme, summary, response_status, response, feedback_source_id, response_source_id, verification, evidence_excerpt)
      VALUES ('fb-test-kitchen', 'con-field-street', 'Kitchen access to outdoors', 'The kitchen should reach the courtyard.', 'no_public_response', 'No response.', 'src-field-page', NULL, 'verified', 'The kitchen should reach the courtyard.')`).run();
    expect(reconcileDocumentedResponses(db, "con-field-street")).toBeGreaterThan(0);
    const row = db.prepare("SELECT response_status, response_source_id, response FROM feedback_themes WHERE id = 'fb-test-kitchen'").get() as { response_status: string; response_source_id: string; response: string };
    expect(row.response_status).toBe("addressed");
    expect(row.response_source_id).toBe("src-field-page");
    expect(row.response).toMatch(/courtyard/);
  });
});
