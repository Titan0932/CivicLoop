import { describe, expect, test } from "vitest";
import { discoverOfficialConsultation } from "@/lib/discovery";

describe("live consultation discovery", () => {
  test("follows bounded direct official document links and extracts exact IDs", async () => {
    const seedUrl = "https://engage.ottawa.ca/example-project";
    const pages: Record<string, string> = {
      [seedUrl]: `<html><body data-page-id="555"><main><h1>Example Project</h1><a href="https://engage.ottawa.ca/555/widgets/88/documents/99">What We Heard</a><a href="https://example.com/not-official">Ignore me</a></main></body></html>`,
      "https://engage.ottawa.ca/555/widgets/88/documents/99": `<html><body data-page-id="555"><main><h1>What We Heard</h1></main></body></html>`,
    };
    const report = await discoverOfficialConsultation(seedUrl, async (url) => {
      if (!pages[url]) throw new Error("unexpected URL");
      return pages[url];
    });
    expect(report.records).toHaveLength(2);
    expect(report.discoveredLinks).toEqual(["https://engage.ottawa.ca/555/widgets/88/documents/99"]);
    expect(report.records[0].identifiers).toEqual(expect.arrayContaining([
      { type: "engage_page_id", value: "555" },
      { type: "engage_widget_id", value: "88" },
      { type: "engage_document_id", value: "99" },
    ]));
  });

  test("rejects arbitrary and private seed URLs", async () => {
    await expect(discoverOfficialConsultation("http://127.0.0.1/internal", async () => ""))
      .rejects.toThrow(/official allowlisted Ottawa/);
    await expect(discoverOfficialConsultation("https://example.com/project", async () => ""))
      .rejects.toThrow(/official allowlisted Ottawa/);
  });

  test("replaces Engage download landing-page text with the extracted attachment", async () => {
    const seedUrl = "https://engage.ottawa.ca/example-project";
    const documentUrl = "https://engage.ottawa.ca/555/widgets/88/documents/99";
    const pages: Record<string, string> = {
      [seedUrl]: `<body data-page-id="555"><main><h1>Example Project</h1><a href="${documentUrl}">What We Heard</a></main></body>`,
      [documentUrl]: `<body><div data-project-id="555" data-widget-id="88" data-document-id="99">The file &quot;What We Heard.pdf&quot; will begin downloading in a few seconds.</div></body>`,
    };
    const report = await discoverOfficialConsultation(
      seedUrl,
      async (url) => pages[url],
      async () => ({ title: "What We Heard.pdf", text: "Residents prioritized safer crossings and more shade.", contentHash: "attachment-hash", contentType: "application/pdf" }),
    );
    expect(report.records[1]).toMatchObject({
      title: "What We Heard.pdf",
      extractedText: "Residents prioritized safer crossings and more shade.",
      contentHash: "attachment-hash",
      retrievalStatus: "success",
    });
  });
});
