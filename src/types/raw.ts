import { ExifData } from './exif';

export interface RawCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface RawValidationResult {
  filepath: string;
  valid: boolean;
  format: string; // DNG, ARW, NEF, etc.
  checks: RawCheck[];
  timestamp?: string;
}

export interface RawValidationOptions {
  exifData?: ExifData; // Optimization: provide if already extracted
}
