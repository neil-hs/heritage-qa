export interface FixScriptOptions {
  outputPath: string;
  dryRun?: boolean; // add echo instead of execute
  backup?: boolean; // backup files before modifying
  batchSize?: number; // commands per script, default all
}

export interface FixableIssue {
  filepath: string;
  fixType: 'exif_tag' | 'color_space' | 'icc_profile';
  tag?: string;
  currentValue?: string;
  targetValue: string;
}
