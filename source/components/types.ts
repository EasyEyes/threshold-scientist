export interface PhrasesData {
  version: string;
  phrases: Record<string, Record<string, string>>;
}

export interface GlossaryEntry {
  name: string;
  availability: string;
  type: string;
  default: string;
  explanation: string;
  example: string;
  categories: string[];
}

export interface GlossaryData {
  version: string;
  glossary: Record<string, GlossaryEntry>;
  glossaryFull: GlossaryEntry[];
  superMatchingParams: string[];
}
