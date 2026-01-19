import { ValidationStatus, Severity } from './config';

export type CheckType = 'jhove' | 'exif' | 'dimension' | 'color' | 'naming' | 'raw_validity';

export interface ValidationResult {
  imageId: number;
  runId: number;
  checkType: CheckType;
  status: ValidationStatus;
  severity?: Severity;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ValidationSummary {
  runId: number;
  version: number;
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  byCheckType: Record<CheckType, { pass: number; fail: number }>;
  bySeverity: Record<Severity, number>;
}

export interface ValidationRun {
  id: number;
  version: number;
  configHash: string;
  startedAt: Date;
  completedAt?: Date;
  summary?: ValidationSummary;
}
