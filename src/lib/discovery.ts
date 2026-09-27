import * as cheerio from "cheerio";
import { EngageOttawaAdapter } from "./adapters/engage";
import { EscribeAdapter } from "./adapters/escribe";
import type { ParsedSource, SourceAdapter } from "./adapters/types";
import {
  fetchEngageAttachment,
  fetchOfficialPage,
  isAllowedOfficialUrl,
  isEngageDocumentUrl,
  type ExtractedAttachment,
} from "./fetcher";
import { contentHash, normalizeContent } from "./hash";

export interface DiscoveryRecord {
  url: string;
  title: string;
  sourceSystem: string;
  identifiers: ParsedSource["identifiers"];
  attachments: ParsedSource["attachments"];
  motionResult: string | null;
  contentHash: string;
  extractedText: string;
  textPreview: string;
  retrievalStatus: "success" | "failed";
  error?: string;
}

export interface DiscoveryReport {
  mode: "live_discovery";
  seedUrl: string;
  checkedAt: string;
  records: DiscoveryRecord[];
  discoveredLinks: string[];
  coverageNote: string;
}

const adapters: SourceAdapter[] = [new EngageOttawaAdapter(), new EscribeAdapter()];

function adapterFor(url: string) {
  return adapters.find((adapter) => adapter.canParse(url));
}

function genericRecord(html: string, url: string): DiscoveryRecord {
  const $ = cheerio.load(html);
  const text = normalizeContent($("main").html() || $("body").html() || html);
  const identifiers: ParsedSource["identifiers"] = [];
  for (const value of new Set(text.match(/ACS\d{4}-[A-Z]{2,5}-[A-Z]{2,5}-\d{3,5}/g) || [])) identifiers.push({ type: "acs_report_number", value });
  for (const value of new Set(text.match(/D\d{2}-\d{2}-\d{2}-\d{4}/g) || [])) identifiers.push({ type: "development_application_number", value });
  return {
    url,
    title: $("h1").first().text().trim() || $("title").text().trim() || new URL(url).pathname,
    sourceSystem: new URL(url).hostname,
    identifiers,
    attachments: [],
    motionResult: null,
    contentHash: contentHash(html),
    extractedText: text,
    textPreview: text.slice(0, 900),
    retrievalStatus: "success",
  };
}

function parseRecord(html: string, url: string): DiscoveryRecord {
  const adapter = adapterFor(url);
  if (!adapter) return genericRecord(html, url);
  const parsed = adapter.parse(html, url);
  return {
    url,
    title: parsed.title,
    sourceSystem: parsed.sourceSystem,
    identifiers: parsed.identifiers,
    attachments: parsed.attachments,
    motionResult: parsed.motionResult,
    contentHash: contentHash(html),
    extractedText: parsed.meaningfulText,
    textPreview: parsed.meaningfulText.slice(0, 900),
    retrievalStatus: "success",
  };
}

function candidateLinks(html: string, baseUrl: string, parsed: DiscoveryRecord) {
  const $ = cheerio.load(html);
  const links = parsed.attachments.map((item) => item.url);
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    let url: URL;
    try { url = new URL(href, baseUrl); } catch { return; }
    const path = url.pathname.toLowerCase();
    const isDocument = /\/\d+\/widgets\/\d+\/documents\/\d+/.test(path);
    const isMeeting = url.hostname === "pub-ottawa.escribemeetings.com" && path.includes("meeting.aspx");
    const isMovedProject = (url.hostname === "ottawa.ca" || url.hostname === "www.ottawa.ca") && (path.includes("public-engagement") || path.includes("project"));
    if ((isDocument || isMeeting || isMovedProject) && isAllowedOfficialUrl(url.toString())) links.push(url.toString());
  });
  return [...new Set(links)].filter((url) => url !== baseUrl).slice(0, 8);
}

export async function discoverOfficialConsultation(
  seedUrl: string,
  fetcher: (url: string) => Promise<string> = fetchOfficialPage,
  attachmentFetcher?: (url: string, fallbackTitle?: string) => Promise<ExtractedAttachment>,
): Promise<DiscoveryReport> {
  if (!isAllowedOfficialUrl(seedUrl)) throw new Error("Use an official allowlisted Ottawa HTTP(S) URL without credentials or a custom port");
  const seedHtml = await fetcher(seedUrl);
  const seedRecord = parseRecord(seedHtml, seedUrl);
  const links = candidateLinks(seedHtml, seedUrl, seedRecord);
  const records = [seedRecord];
  const loadAttachment = attachmentFetcher || (fetcher === fetchOfficialPage ? fetchEngageAttachment : null);
  for (const url of links) {
    try {
      const record = parseRecord(await fetcher(url), url);
      if (loadAttachment && isEngageDocumentUrl(url)) {
        const attachment = await loadAttachment(url, record.title);
        record.title = attachment.title;
        record.extractedText = attachment.text;
        record.textPreview = attachment.text.slice(0, 900);
        record.contentHash = attachment.contentHash;
      }
      records.push(record);
    } catch (error) {
      records.push({
        url, title: url, sourceSystem: new URL(url).hostname, identifiers: [], attachments: [], motionResult: null,
        contentHash: "", extractedText: "", textPreview: "", retrievalStatus: "failed",
        error: error instanceof Error ? error.message : "Unknown retrieval error",
      });
    }
  }
  return {
    mode: "live_discovery",
    seedUrl,
    checkedAt: new Date().toISOString(),
    records,
    discoveredLinks: links,
    coverageNote: "Discovery follows direct official links and exact attachment relationships only. Records in separate systems without an official link or known identifier remain review candidates, not asserted matches.",
  };
}
