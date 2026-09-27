import * as cheerio from "cheerio";
import { normalizeContent } from "../hash";
import type { ParsedSource, SourceAdapter } from "./types";

const ACS_PATTERN = /ACS\d{4}-[A-Z]{2,5}-[A-Z]{2,5}-\d{3,5}/g;

export class EscribeAdapter implements SourceAdapter {
  readonly sourceSystem = "Ottawa eScribe" as const;

  canParse(url: string) {
    return new URL(url).hostname === "pub-ottawa.escribemeetings.com";
  }

  parse(html: string, url: string): ParsedSource {
    if (!this.canParse(url)) throw new Error("eScribe adapter received a non-eScribe URL");
    const parsedUrl = new URL(url);
    const $ = cheerio.load(html);
    const meetingId = parsedUrl.searchParams.get("Id") || $("[data-meeting-id]").first().attr("data-meeting-id") || null;
    const agendaItem = parsedUrl.searchParams.get("Item") || $("[data-item]").first().attr("data-item") || null;
    const bodyText = $("body").text();
    const acsNumbers = [...new Set(bodyText.match(ACS_PATTERN) || [])];
    const identifiers: ParsedSource["identifiers"] = [];
    if (meetingId) identifiers.push({ type: "escribe_meeting_uuid", value: meetingId });
    if (agendaItem) identifiers.push({ type: "agenda_item_number", value: agendaItem });
    for (const value of acsNumbers) identifiers.push({ type: "acs_report_number", value });
    const attachments = $("a[data-document-id], a[href*='DocumentId=']").map((_, element) => {
      const node = $(element);
      const href = node.attr("href") || "";
      const hrefUrl = new URL(href, url);
      const documentId = node.attr("data-document-id") || hrefUrl.searchParams.get("DocumentId");
      if (documentId) identifiers.push({ type: "filestream_document_id", value: documentId });
      return { title: node.text().trim(), url: hrefUrl.toString(), documentId };
    }).get();
    return {
      sourceSystem: this.sourceSystem,
      title: $(".AgendaItem h2, [data-item] h2, h1").first().text().trim(),
      identifiers: [...new Map(identifiers.map((item) => [`${item.type}:${item.value}`, item])).values()],
      attachments,
      motionResult: $(".MotionResult").first().text().trim() || null,
      meaningfulText: normalizeContent($(".AgendaItem, [data-item]").first().html() || $("body").html() || html),
    };
  }
}
