import { basename, extname } from "path";
import { Severity, ProjectSpec } from "../types/config";

export type FilenameRule =
  | 'pattern'
  | 'spaces'
  | 'special_chars'
  | 'prefix'
  | 'length'
  | 'extension_case';

export interface FilenameFailure {
  rule: FilenameRule;
  message: string;
  severity: Severity;
}

export interface FilenameCheckResult {
  filepath: string;
  filename: string;
  passed: boolean;
  failures: FilenameFailure[];
}

export function validateFilename(
  filepath: string,
  spec: ProjectSpec['naming']
): FilenameCheckResult {
  const filename = basename(filepath);
  const ext = extname(filename);
  const failures: FilenameFailure[] = [];

  if (!spec) {
    return { filepath, filename, passed: true, failures: [] };
  }

  // Pattern Match
  if (spec.pattern) {
    try {
      const regex = new RegExp(spec.pattern);
      if (!regex.test(filename)) {
        failures.push({
          rule: 'pattern',
          message: `Filename doesn't match pattern: ${spec.pattern}`,
          severity: 'warning'
        });
      }
    } catch (e) {
      console.warn(`Invalid regex pattern: ${spec.pattern}`, e);
    }
  }

  // No Spaces
  // spec.allow_spaces defaults to true if undefined? PRD says:
  // spec.naming.allow_spaces: false (example)
  // If undefined, do we allow? Usually yes.
  if (spec.allow_spaces === false && filename.includes(' ')) {
    failures.push({
      rule: 'spaces',
      message: 'Filename contains spaces',
      severity: 'fixable'
    });
  }

  // Required Prefix
  if (spec.required_prefix && !filename.startsWith(spec.required_prefix)) {
    failures.push({
      rule: 'prefix',
      message: `Missing required prefix: ${spec.required_prefix}`,
      severity: 'fixable'
    });
  }

  // Special Characters
  // PRD: const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1F]/;
  // Note: / and \ should not be in basename usually, but good to check.
  const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1F]/;
  if (UNSAFE_CHARS.test(filename)) {
    failures.push({
      rule: 'special_chars',
      message: 'Filename contains unsafe characters',
      severity: 'fixable'
    });
  }

  // Extension Case
  // Warn if extension is uppercase: .TIF vs .tif
  // Logic: ext !== ext.toLowerCase()
  if (ext && ext !== ext.toLowerCase()) {
    failures.push({
      rule: 'extension_case',
      message: 'Extension should be lowercase',
      severity: 'warning'
    });
  }

  return {
    filepath,
    filename,
    passed: failures.length === 0,
    failures
  };
}

export function validateFilenames(
  filepaths: string[],
  spec: ProjectSpec['naming']
): FilenameCheckResult[] {
  return filepaths.map(fp => validateFilename(fp, spec));
}
