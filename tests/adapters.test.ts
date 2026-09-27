import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { EngageOttawaAdapter } from "@/lib/adapters/engage";
import { EscribeAdapter } from "@/lib/adapters/escribe";

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");

describe("official source adapters", () => {
  test("extracts Engage project, widget, and attachment IDs", () => {
    const parsed = new EngageOttawaAdapter().parse(fixture("engage-field-street.html"), "https://engage.ottawa.ca/field-street-sidewalk");
    expect(parsed.title).toBe("Field Street Sidewalk");
    expect(parsed.identifiers).toEqual(expect.arrayContaining([
      { type: "engage_page_id", value: "37100" },
      { type: "engage_widget_id", value: "161486" },
      { type: "engage_document_id", value: "112135" },
    ]));
    expect(parsed.attachments[0]).toMatchObject({ documentId: "112135", projectId: "37100", widgetId: "161486" });
  });

  test("extracts eScribe meeting, item, ACS, attachment, and result", () => {
    const url = "https://pub-ottawa.escribemeetings.com/Meeting.aspx?Agenda=PostMinutes&Id=a016f492-7ff8-4635-8186-b541536253f6&Item=63&Tab=attachments&lang=English";
    const parsed = new EscribeAdapter().parse(fixture("escribe-community-garden-2025.html"), url);
    expect(parsed.identifiers).toEqual(expect.arrayContaining([
      { type: "escribe_meeting_uuid", value: "a016f492-7ff8-4635-8186-b541536253f6" },
      { type: "agenda_item_number", value: "63" },
      { type: "acs_report_number", value: "ACS2025-CSS-GEN-007" },
      { type: "filestream_document_id", value: "230509" },
    ]));
    expect(parsed.motionResult).toBe("Carried");
    expect(parsed.attachments).toHaveLength(2);
  });

  test("fails closed for an adapter/host mismatch", () => {
    expect(() => new EngageOttawaAdapter().parse("<h1>Wrong</h1>", "https://example.com")).toThrow(/non-Engage/);
  });

  test("extracts IDs and filename from a live-style Engage document page", () => {
    const html = `<body><h1>Documents</h1><div data-project-id="12522" data-widget-id="59966" data-document-id="168581">The file &quot;What We Learned.pdf&quot; will begin downloading in a few seconds.</div></body>`;
    const parsed = new EngageOttawaAdapter().parse(html, "https://engage.ottawa.ca/12522/widgets/59966/documents/168581");
    expect(parsed.title).toBe("What We Learned.pdf");
    expect(parsed.identifiers).toEqual(expect.arrayContaining([
      { type: "engage_page_id", value: "12522" },
      { type: "engage_widget_id", value: "59966" },
      { type: "engage_document_id", value: "168581" },
    ]));
  });
});
