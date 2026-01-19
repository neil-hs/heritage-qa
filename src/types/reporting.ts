import { Database } from "bun:sqlite";

export type CsvExportType = 'failed' | 'all' | 'summary';

export interface CsvOptions {
  outputPath: string;
  type: CsvExportType;
  delimiter?: ',' | '\t' | ';';
  includeHeader?: boolean;
}

export interface MarkdownOptions {
  outputPath: string;
  maxFailedFiles?: number; // limit list, default 50
  includeConfig?: boolean;
}

export interface HtmlReportOptions {
  outputPath: string;
  title?: string;
  includeDatabase?: boolean; // embed SQL.js, default true
  theme?: 'light' | 'dark';
  dbPath?: string; // Path to database file for embedding
}
