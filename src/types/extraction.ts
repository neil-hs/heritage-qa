import { FileType } from './config';
import type { ProgressState } from '../utils/progress-tracker';

export interface FileInfo {
  path: string;
  filename: string;
  extension: string;
  fileType: FileType;
  fileSize: number;
}

export interface ScanSummary {
  totalMatched: number;
  totalMismatched: number;
  totalSkipped: number;
  byType: Record<FileType, number>;
}

export interface ScanResult {
  matched: FileInfo[];
  mismatched: FileInfo[];
  skipped: string[]; // non-image files
  summary: ScanSummary;
}

export interface BatchOptions {
  chunkSize?: number; // default 100
  concurrency?: number; // default 1 (sequential for stability)
  onProgress?: (state: ProgressState) => void;
  resumeFrom?: number; // image ID to resume from
  files?: FileInfo[]; // optional file list for resumeProcessing
}

export interface BatchError {
  filepath: string;
  error: string;
}

export interface BatchResult {
  processed: number;
  failed: number;
  skipped: number;
  errors: BatchError[];
  duration: number; // ms
}

export interface ExifToolResult {
  success: boolean;
  data?: any; // ExifData is generic
  error?: string;
  rawOutput?: string;
}

export interface ExifToolOptions {
  timeout?: number; // ms, default 30000
  tags?: string[]; // specific tags to extract, default all
}
