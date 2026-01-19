import { Database } from 'bun:sqlite';
import { ImageInfo } from '../types/exif';
import { ProjectSpec, Severity, ValidationStatus } from '../types/config';
import { DimensionCheckResult, validateDimensions } from './dimension-validator';
import { ColorCheckResult, validateColor } from './color-validator';
import { ExifTagCheckResult, validateExifTags } from './exif-tag-validator';
import { JhoveResult } from '../types/jhove';
import { validateTiff } from './jhove';
import { RawValidationResult, RawCheck } from '../types/raw';
import { validateRaw } from './raw-validator';
import { insertValidationResult, getImageWithExif, startValidationRun } from '../utils/query-helpers';
import { ProgressState } from '../utils/progress-tracker';

const RAW_CHECK_SEVERITY: Record<string, Severity> = {
  file_readable: 'critical',
  has_exif: 'critical',
  has_dimensions: 'critical',
  camera_metadata: 'fixable'
};

const SEVERITY_RANK: Record<Severity, number> = {
  warning: 0,
  fixable: 1,
  critical: 2
};

function maxSeverity(a?: Severity, b?: Severity): Severity | undefined {
  if (!a) return b;
  if (!b) return a;
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

function formatFailureMessage(failure: any): string {
  const label = failure.check ?? failure.tag ?? 'check';
  if (failure.expected !== undefined && failure.actual !== undefined) {
    return `${label}: Exp ${failure.expected}, Act ${failure.actual}`;
  }
  if (failure.reason) {
    return `${label}: ${failure.reason}`;
  }
  return `${label}: failed`;
}

function formatCheckMessage(check: RawCheck): string {
  return `${check.name}: ${check.message ?? 'failed'}`;
}

function formatMessages(items: Array<{ message?: string }>): string {
  return items.map(item => item.message ?? 'warning').join('; ');
}

function summarizeFailures(failures: any[]): { severity?: Severity; message?: string } {
  let severity: Severity | undefined;
  const messages: string[] = [];

  for (const failure of failures) {
    if (!failure) continue;
    severity = maxSeverity(severity, failure.severity as Severity | undefined);
    messages.push(formatFailureMessage(failure));
  }

  return {
    severity,
    message: messages.join('; ')
  };
}

function summarizeCheckResult(result: any): { severity?: Severity; message?: string } {
  if (!result) {
    return { severity: undefined };
  }

  if (Array.isArray(result.failures) && result.failures.length > 0) {
    return summarizeFailures(result.failures);
  }

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return {
      severity: 'critical',
      message: formatMessages(result.errors)
    };
  }

  if (Array.isArray(result.checks)) {
    const failedChecks = result.checks.filter((check: RawCheck) => !check.passed);
    if (failedChecks.length > 0) {
      let severity: Severity | undefined;
      for (const check of failedChecks) {
        severity = maxSeverity(severity, RAW_CHECK_SEVERITY[check.name] ?? 'critical');
      }
      return {
        severity,
        message: failedChecks.map(formatCheckMessage).join('; ')
      };
    }
  }

  if (Array.isArray(result.warnings) && result.warnings.length > 0) {
    return {
      severity: 'warning',
      message: formatMessages(result.warnings)
    };
  }

  return { severity: undefined };
}

interface ValidateImageOptions {
  runJhove?: boolean;
  treatWarningsAsCritical?: boolean;
}

export interface ValidateBatchOptions {
  runJhove?: boolean;
  onProgress?: (state: ProgressState) => void;
}

export interface SpecValidationResult {
  imageId: number;
  filepath: string;
  passed: boolean;
  checks: {
    dimension?: DimensionCheckResult;
    color?: ColorCheckResult;
    exifTags?: ExifTagCheckResult;
    jhove?: JhoveResult;
    raw?: RawValidationResult;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    critical: number;
    fixable: number;
    warnings: number;
  };
}

export interface ValidationSummary {
  runId: number;
  version: number;
  total: number;
  passed: number;
  failed: number;
  bySeverity: {
    critical: number;
    fixable: number;
    warning: number;
  };
  byCheck: {
    dimension: { pass: number; fail: number };
    color: { pass: number; fail: number };
    exifTags: { pass: number; fail: number };
    jhove: { pass: number; fail: number };
    raw: { pass: number; fail: number };
  };
}

export async function validateImage(
  db: Database,
  image: ImageInfo,
  spec: ProjectSpec,
  runId: number,
  options: ValidateImageOptions = {}
): Promise<SpecValidationResult> {
  let imageWithExif = image;
  if (!image.exif && image.id) {
    const fetched = getImageWithExif(db, image.id);
    if (fetched) {
      imageWithExif = fetched;
    }
  }

  const exif = imageWithExif.exif || {};
  const checks: SpecValidationResult['checks'] = {};
  const shouldRunJhove = options.runJhove ?? spec.validation.run_jhove;
  const warningsAreCritical = options.treatWarningsAsCritical ?? !!spec.validation.treat_warnings_as_critical;

  if (spec.dimensions) {
    checks.dimension = validateDimensions(exif, spec.dimensions);
  }

  if (spec.color) {
    checks.color = validateColor(exif, spec.color);
  }

  if (spec.required_exif && spec.required_exif.length > 0) {
    checks.exifTags = validateExifTags(exif, spec.required_exif);
  }

  if (shouldRunJhove && image.fileType === 'TIFF') {
    try {
      checks.jhove = await validateTiff(image.filepath);
    } catch (e: any) {
      checks.jhove = {
        filepath: image.filepath,
        valid: false,
        wellFormed: false,
        status: 'error',
        errors: [{ message: e.message }],
        warnings: []
      };
    }
  }

  if (spec.validation.check_raw_validity && image.fileType === 'RAW') {
    checks.raw = await validateRaw(image.filepath, { exifData: exif });
  }

  let passed = true;
  let failed = 0;
  let critical = 0;
  let fixable = 0;
  let warnings = 0;
  let passedCount = 0;
  let totalChecks = 0;

  const processResult = (checkName: string, result: any) => {
    totalChecks++;
    const summary = summarizeCheckResult(result);
    let { severity, message } = summary;
    let status: ValidationStatus = 'pass';

    if (severity) {
      if (severity === 'warning' && !warningsAreCritical) {
        status = 'warning';
      } else {
        status = 'fail';
        if (severity === 'warning' && warningsAreCritical) {
          severity = 'critical';
        }
      }
    } else if (result.passed === false || result.valid === false) {
      severity = 'critical';
      status = 'fail';
      if (!message) {
        message = 'Validation failed without additional details';
      }
    }

    if (status === 'fail') {
      passed = false;
      failed++;
    }

    if (!severity) {
      passedCount++;
    } else if (severity === 'critical') {
      critical++;
    } else if (severity === 'fixable') {
      fixable++;
    } else if (severity === 'warning') {
      warnings++;
    }

    insertValidationResult(db, {
      image_id: image.id,
      validation_run: runId,
      check_type: checkName,
      status,
      severity: severity,
      message: status === 'pass' ? null : message || status,
      details: JSON.stringify(result)
    });
  };

  if (checks.dimension) processResult('dimension', checks.dimension);
  if (checks.color) processResult('color', checks.color);
  if (checks.exifTags) processResult('exif', checks.exifTags);
  if (checks.jhove) processResult('jhove', checks.jhove);
  if (checks.raw) processResult('raw_validity', checks.raw);

  return {
    imageId: image.id,
    filepath: image.filepath,
    passed,
    checks,
    summary: {
      total: totalChecks,
      passed: passedCount,
      failed,
      critical,
      fixable,
      warnings
    }
  };
}

export async function validateBatch(
  db: Database,
  images: ImageInfo[],
  spec: ProjectSpec,
  options: ValidateBatchOptions = {}
): Promise<{
  results: SpecValidationResult[];
  summary: ValidationSummary;
}> {
  const configHash = JSON.stringify(spec).length.toString(); // TODO: Real hash
  const runId = startValidationRun(db, 1, configHash);

  const shouldRunJhove = options.runJhove ?? spec.validation.run_jhove;

  const results: SpecValidationResult[] = [];
  const summary: ValidationSummary = {
    runId,
    version: 1,
    total: images.length,
    passed: 0,
    failed: 0,
    bySeverity: { critical: 0, fixable: 0, warning: 0 },
    byCheck: {
      dimension: { pass: 0, fail: 0 },
      color: { pass: 0, fail: 0 },
      exifTags: { pass: 0, fail: 0 },
      jhove: { pass: 0, fail: 0 },
      raw: { pass: 0, fail: 0 }
    }
  };

  const startTime = Date.now();
  const progressErrors: ProgressState['errors'] = [];
  const progressState: ProgressState = {
    operation: 'spec-validation',
    phase: 'processing',
    total: images.length,
    completed: 0,
    failed: 0,
    startedAt: new Date(startTime).toISOString(),
    updatedAt: new Date(startTime).toISOString(),
    errors: []
  };

  let completed = 0;

  const emitProgress = (currentFile?: string) => {
    const now = Date.now();
    progressState.completed = completed;
    progressState.failed = summary.failed;
    progressState.currentFile = currentFile;
    progressState.updatedAt = new Date(now).toISOString();
    progressState.errors = [...progressErrors];

    const elapsed = now - startTime;
    const rate = elapsed > 0 ? completed / elapsed : 0;
    const remaining = Math.max(progressState.total - completed, 0);
    progressState.estimatedCompletion =
      rate > 0 && remaining > 0
        ? new Date(now + remaining / rate).toISOString()
        : undefined;

    if (options.onProgress) {
      options.onProgress({ ...progressState, errors: [...progressState.errors] });
    }
  };

  if (options.onProgress) {
    emitProgress();
  }

  for (const image of images) {
    const result = await validateImage(db, image, spec, runId, { runJhove: shouldRunJhove });
    results.push(result);

    if (!result.passed) summary.failed++;
    else summary.passed++;

    if (result.checks.dimension) {
      if (result.checks.dimension.passed) summary.byCheck.dimension.pass++;
      else summary.byCheck.dimension.fail++;
    }
    if (result.checks.color) {
      if (result.checks.color.passed) summary.byCheck.color.pass++;
      else summary.byCheck.color.fail++;
    }
    if (result.checks.exifTags) {
      if (result.checks.exifTags.passed) summary.byCheck.exifTags.pass++;
      else summary.byCheck.exifTags.fail++;
    }
    if (result.checks.jhove) {
      if (result.checks.jhove.valid) summary.byCheck.jhove.pass++;
      else summary.byCheck.jhove.fail++;
    }
    if (result.checks.raw) {
      if (result.checks.raw.valid) summary.byCheck.raw.pass++;
      else summary.byCheck.raw.fail++;
    }

    summary.bySeverity.critical += result.summary.critical;
    summary.bySeverity.fixable += result.summary.fixable;
    summary.bySeverity.warning += result.summary.warnings;

    if (result.summary.failed > 0) {
      progressErrors.push({
        file: image.filepath,
        error: `${result.summary.failed} check${result.summary.failed === 1 ? '' : 's'} failed`,
        timestamp: new Date().toISOString()
      });
    }

    completed++;
    emitProgress(image.filepath);
  }

  progressState.phase = 'completed';
  emitProgress();

  db.run(
    `
    UPDATE validation_runs 
    SET completed_at = CURRENT_TIMESTAMP, 
        total_images = $total, 
        passed = $passed, 
        failed = $failed 
    WHERE id = $id
  `,
    {
      $total: summary.total,
      $passed: summary.passed,
      $failed: summary.failed,
      $id: runId
    }
  );

  return { results, summary };
}
