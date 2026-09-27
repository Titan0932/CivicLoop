import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { contentHash } from "./hash";

const ALLOWED_HOSTS = new Set([
  "engage.ottawa.ca",
  "pub-ottawa.escribemeetings.com",
  "ottawa.ca",
  "www.ottawa.ca",
  "documents.ottawa.ca",
  "webcast.ottawa.ca",
]);

const ENGAGE_ATTACHMENT_HOSTS = new Set([
  "ehq-production-canada.s3.ca-central-1.amazonaws.com",
]);

const MAX_PAGE_BYTES = 2_000_000;
const MAX_ATTACHMENT_BYTES = 20_000_000;

export interface ExtractedAttachment {
  title: string;
  text: string;
  contentHash: string;
  contentType: string;
}

export function isAllowedOfficialUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === "https:" || url.protocol === "http:") && ALLOWED_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export function isEngageDocumentUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "engage.ottawa.ca" && /^\/\d+\/widgets\/\d+\/documents\/\d+$/.test(url.pathname.replace(/\/+$/, ""));
  } catch {
    return false;
  }
}

function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function requirePublicResolution(hostname: string) {
  const addresses = await lookup(hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Source resolved to a private network address");
}

export async function validateOfficialUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) sources are supported");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`Source host is not allowlisted: ${url.hostname}`);
  if (url.username || url.password || url.port) throw new Error("Credentials and custom ports are not allowed in source URLs");
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error("Private network destinations are not allowed");
  await requirePublicResolution(url.hostname);
  return url;
}

async function validateAttachmentUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ENGAGE_ATTACHMENT_HOSTS.has(url.hostname) || url.username || url.password || url.port) {
    throw new Error("The official document redirected to an untrusted download host");
  }
  await requirePublicResolution(url.hostname);
  return url;
}

async function fetchOfficialPageResponse(rawUrl: string): Promise<Response> {
  let url = await validateOfficialUrl(rawUrl);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": "CivicLoop/1.0 civic transparency research; contact: local-demo" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Source returned an invalid or excessive redirect");
      url = await validateOfficialUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    return response;
  }
  throw new Error("Could not retrieve source");
}

export async function fetchOfficialPage(rawUrl: string): Promise<string> {
  const response = await fetchOfficialPageResponse(rawUrl);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) throw new Error(`Unsupported source content type: ${contentType || "unknown"}`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_PAGE_BYTES) throw new Error("Source response exceeds the 2 MB limit");
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_PAGE_BYTES) throw new Error("Source response exceeds the 2 MB limit");
  return text;
}

function filenameFromDisposition(value: string | null) {
  if (!value) return null;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded.replace(/^"|"$/g, "")); } catch { return encoded; }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1]?.trim() || null;
}

async function extractAttachmentText(buffer: Buffer, title: string, contentType: string) {
  const lowerTitle = title.toLowerCase();
  const isPdf = contentType.includes("pdf") || lowerTitle.endsWith(".pdf") || buffer.subarray(0, 5).toString() === "%PDF-";
  const isDocx = contentType.includes("officedocument.wordprocessingml") || lowerTitle.endsWith(".docx");
  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    try { return (await parser.getText()).text.trim(); } finally { await parser.destroy(); }
  }
  if (isDocx) return (await mammoth.extractRawText({ buffer })).value.trim();
  throw new Error(`Unsupported official attachment type: ${contentType || title}`);
}

export async function fetchEngageAttachment(rawUrl: string, fallbackTitle = "Official consultation document"): Promise<ExtractedAttachment> {
  if (!isEngageDocumentUrl(rawUrl)) throw new Error("Engage attachment URL did not match the expected official document path");
  const officialUrl = await validateOfficialUrl(rawUrl);
  const downloadUrl = new URL(`${officialUrl.pathname.replace(/\/+$/, "")}/download`, officialUrl.origin);
  const redirect = await fetch(downloadUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
    headers: { "user-agent": "CivicLoop/1.0 civic transparency research; contact: local-demo" },
  });
  if (redirect.status < 300 || redirect.status >= 400) throw new Error(`Official document download returned HTTP ${redirect.status}`);
  const location = redirect.headers.get("location");
  if (!location) throw new Error("Official document download did not provide a file location");
  const attachmentUrl = await validateAttachmentUrl(new URL(location, downloadUrl).toString());
  const response = await fetch(attachmentUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "CivicLoop/1.0 civic transparency research; contact: local-demo" },
  });
  if (!response.ok) throw new Error(`Official attachment returned HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_ATTACHMENT_BYTES) throw new Error("Official attachment exceeds the 20 MB limit");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("Official attachment exceeds the 20 MB limit");
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const title = filenameFromDisposition(response.headers.get("content-disposition")) || fallbackTitle;
  const text = await extractAttachmentText(buffer, title, contentType);
  if (text.length < 20) throw new Error("The official attachment did not contain extractable text");
  return { title, text, contentHash: contentHash(text), contentType };
}

export async function fetchOfficialSource(rawUrl: string): Promise<string> {
  if (isEngageDocumentUrl(rawUrl)) return (await fetchEngageAttachment(rawUrl)).text;
  return fetchOfficialPage(rawUrl);
}
