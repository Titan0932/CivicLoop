export interface ParsedAttachment {
  title: string;
  url: string;
  documentId: string | null;
  projectId?: string | null;
  widgetId?: string | null;
}

export interface ParsedSource {
  sourceSystem: "Engage Ottawa" | "Ottawa eScribe";
  title: string;
  identifiers: Array<{ type: string; value: string }>;
  attachments: ParsedAttachment[];
  motionResult: string | null;
  meaningfulText: string;
}

export interface SourceAdapter {
  readonly sourceSystem: ParsedSource["sourceSystem"];
  canParse(url: string): boolean;
  parse(html: string, url: string): ParsedSource;
}
