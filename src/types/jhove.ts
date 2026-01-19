export interface JhoveError {
  message: string;
  offset?: number;
}

export interface JhoveWarning {
  message: string;
}

export interface JhoveResult {
  filepath: string;
  valid: boolean;
  wellFormed: boolean;
  status: 'valid' | 'not-valid' | 'not-well-formed' | 'error';
  format?: string;
  version?: string;
  errors: JhoveError[];
  warnings: JhoveWarning[];
  rawXml?: string;
  errorMessage?: string; // If execution failed
}

export interface JhoveOptions {
  timeout?: number; // ms, default 60000
  outputDir?: string; // for XML output
  jhovePath?: string; // Custom path to jhove binary
}
