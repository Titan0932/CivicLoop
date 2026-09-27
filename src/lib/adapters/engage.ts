import * as cheerio from "cheerio";
import { normalizeContent } from "../hash";
import type { ParsedSource, SourceAdapter } from "./types";

export class EngageOttawaAdapter implements SourceAdapter {
  readonly sourceSystem = "Engage Ottawa" as const;

  canParse(url: string) {
    return new URL(url).hostname === "engage.ottawa.ca";
  }

  parse(html: string, url: string): ParsedSource {
    if (!this.canParse(url)) throw new Error("Engage adapter received a non-Engage URL");
    const $ = cheerio.load(html);
    const projectId = $("[data-project-id]").first().attr("data-project-id") || $("[data-page-id]").first().attr("data-page-id") || null;
    const identifiers: ParsedSource["identifiers"] = [];
    if (projectId) identifiers.push({ type: "engage_page_id", value: projectId });
    const documentMeta = $("[data-project-id][data-widget-id][data-document-id]").first();
    const directWidgetId = documentMeta.attr("data-widget-id") || null;
    const directDocumentId = documentMeta.attr("data-document-id") || null;
    if (directWidgetId) identifiers.push({ type: "engage_widget_id", value: directWidgetId });
    if (directDocumentId) identifiers.push({ type: "engage_document_id", value: directDocumentId });
    const attachments = $("a[data-document-id], a[href*='/widgets/'][href*='/documents/']").map((_, element) => {
      const node = $(element);
      const href = node.attr("href") || "";
      const pathMatch = href.match(/\/(\d+)\/widgets\/(\d+)\/documents\/(\d+)/);
      const widgetId = node.closest("[data-widget-id]").attr("data-widget-id") || pathMatch?.[2] || null;
      const documentId = node.attr("data-document-id") || pathMatch?.[3] || null;
      const attachmentProjectId = projectId || pathMatch?.[1] || null;
      if (widgetId) identifiers.push({ type: "engage_widget_id", value: widgetId });
      if (documentId) identifiers.push({ type: "engage_document_id", value: documentId });
      return {
        title: node.text().trim(), url: new URL(href, url).toString(), documentId, projectId: attachmentProjectId, widgetId,
      };
    }).get();
    const bodyText = $("body").text().replace(/\s+/g, " ");
    const downloadedFilename = bodyText.match(/The file [“\"]([^”\"]+)[”\"] will begin downloading/i)?.[1];
    return {
      sourceSystem: this.sourceSystem,
      title: downloadedFilename || $("h1").first().text().trim() || $("title").text().trim(),
      identifiers: [...new Map(identifiers.map((item) => [`${item.type}:${item.value}`, item])).values()],
      attachments,
      motionResult: null,
      meaningfulText: normalizeContent($("main").html() || $("body").html() || html),
    };
  }
}
