import { ExifData } from '../types/exif';
import { RequiredExifTag, Severity } from '../types/config';

export interface TagFailure {
  tag: string;
  reason: 'missing' | 'wrong_value';
  expected?: string;
  actual?: string;
  severity: Severity;
}

export interface TagCheckDetail {
  tag: string;
  present: boolean;
  value?: string;
  expectedValue?: string;
  matches: boolean;
}

export interface ExifTagCheckResult {
  passed: boolean;
  checkedTags: TagCheckDetail[];
  failures: TagFailure[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchValue(actual: unknown, expected: string, allowVariations: boolean = false): boolean {
  const actualStr = String(actual).trim();
  const expectedStr = expected.trim();

  if (allowVariations) {
    // PRD example: "Sony" matches "SONY CORPORATION".
    // Wait, that's a partial match. "Sony" vs "SONY CORPORATION"
    // The PRD says: "For cameras: 'Sony' matches 'SONY CORPORATION'"
    // This implies 'includes' logic or fuzzy match.
    // "Ignores leading/trailing whitespace" (handled by trim)
    // "Case-insensitive" (handled by toLowerCase)
    // I will implement 'includes' logic if allowVariations is true, assuming the shorter one might be the expected one?
    // Or does it mean the Expected "Sony" should match Actual "SONY CORPORATION"?
    // Usually Config has "Sony", Actual has "SONY CORPORATION".
    // So if Actual includes Expected (normalized).
    
    // Let's assume Includes logic for now.
    const normActual = normalize(actualStr);
    const normExpected = normalize(expectedStr);
    
    return normActual.includes(normExpected);
  }

  return actualStr === expectedStr;
}

export function validateExifTags(
  exif: ExifData,
  requiredTags: RequiredExifTag[]
): ExifTagCheckResult {
  if (!requiredTags || requiredTags.length === 0) {
    return { passed: true, checkedTags: [], failures: [] };
  }

  const checkedTags: TagCheckDetail[] = [];
  const failures: TagFailure[] = [];

  for (const req of requiredTags) {
    const value = exif[req.tag];
    const present = value !== undefined && value !== null && value !== '';
    let matches = false;
    let actualStr = present ? String(value) : undefined;

    if (!present) {
      failures.push({
        tag: req.tag,
        reason: 'missing',
        severity: 'fixable'
      });
      checkedTags.push({
        tag: req.tag,
        present: false,
        matches: false,
        expectedValue: req.expected_value
      });
    } else {
      // Present, check value if expected
      if (req.expected_value) {
        matches = matchValue(value, req.expected_value, req.allow_variations);
        if (!matches) {
          failures.push({
            tag: req.tag,
            reason: 'wrong_value',
            expected: req.expected_value,
            actual: actualStr,
            severity: 'fixable'
          });
        }
      } else {
        // Only presence required
        matches = true;
      }

      checkedTags.push({
        tag: req.tag,
        present: true,
        value: actualStr,
        expectedValue: req.expected_value,
        matches
      });
    }
  }

  return {
    passed: failures.length === 0,
    checkedTags,
    failures
  };
}
