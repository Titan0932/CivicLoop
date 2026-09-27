import type { DatabaseSync } from "node:sqlite";

type SourceRow = { id: string; extracted_text: string };
type FeedbackRow = { id: string; theme: string; summary: string; response_status: string; response_source_id: string | null };

export function reconcileDocumentedResponses(db: DatabaseSync, consultationId: string) {
  const sources = db.prepare("SELECT id, extracted_text FROM source_documents WHERE consultation_id = ?").all(consultationId) as unknown as SourceRow[];
  const optionsSource = sources.find((source) => /consultants reviewed all the feedback[\s\S]{0,180}Option 3 came forward as the preferred option/i.test(source.extracted_text));
  const fundingSource = sources.find((source) => /full funding.*secured[\s\S]{0,240}(?:gymnasium|facility expansion)/i.test(source.extracted_text));
  if (!optionsSource && !fundingSource) return 0;

  const themes = db.prepare("SELECT id, theme, summary, response_status, response_source_id FROM feedback_themes WHERE consultation_id = ?").all(consultationId) as unknown as FeedbackRow[];
  let changed = 0;
  const update = (row: FeedbackRow, status: string, response: string, sourceId: string, force = false) => {
    if (!force && row.response_status !== "no_public_response" && row.response_source_id) return;
    const result = db.prepare("UPDATE feedback_themes SET response_status = ?, response = ?, response_source_id = ? WHERE id = ?")
      .run(status, response, sourceId, row.id);
    changed += Number(result.changes);
  };

  for (const row of themes) {
    const subject = `${row.theme} ${row.summary}`.toLowerCase();
    if (fundingSource && /top priority.*gym|new gymnasium/.test(subject)) {
      update(row, "addressed", "The project page says the gymnasium priority helped support the funding request. Full funding was later secured and the expansion entered detailed design.", fundingSource.id);
      continue;
    }
    if (!optionsSource) continue;
    if (/group activit/.test(subject)) update(row, "addressed", "The preferred Option 3 includes a full-size gymnasium, multipurpose rooms, a teen lounge, and a separate computer area for community programming.", optionsSource.id);
    else if (/kitchen.*(?:design|bigger|two families)/.test(subject)) update(row, "addressed", "The preferred Option 3 includes the largest kitchen of the options reviewed.", optionsSource.id);
    else if (/kitchen.*(?:outdoor|greenspace|courtyard)|access to outdoors/.test(subject)) update(row, "addressed", "The preferred Option 3 gives the kitchen access to the outdoor courtyard.", optionsSource.id);
    else if (/teen|computer space/.test(subject)) update(row, "addressed", "The preferred Option 3 includes a teen lounge and a separate computer area.", optionsSource.id);
    else if (/library entrance/.test(subject)) update(row, "partially_addressed", "The preferred Option 3 includes a potential library space, but the checked report does not confirm a dedicated library entrance.", optionsSource.id);
    else if (/potential.*library|inclusion of a library/.test(subject)) update(row, "partially_addressed", "The preferred Option 3 retains space for a potential library.", optionsSource.id);
    else if (/gymnasium.*(?:flexibility|storage)|gym.*divider/.test(subject)) update(row, "partially_addressed", "The preferred Option 3 includes a full-size gymnasium, but the checked response does not confirm the requested divider and two-sided storage access.", optionsSource.id);
    else if (/materials|atmosphere|treatments/.test(subject)) update(row, "acknowledged", "The report says materials and treatments will be considered during design development and confirmed through further public engagement.", optionsSource.id, true);
    else if (/inclusiv|accessib|gender-neutral/.test(subject)) update(row, "partially_addressed", "The preferred Option 3 includes a gender-neutral family change room intended to promote inclusion; the response does not address every accessibility suggestion recorded.", optionsSource.id);
  }
  return changed;
}
