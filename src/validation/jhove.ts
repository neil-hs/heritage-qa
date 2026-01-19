import { spawn } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'node:url';
import { JhoveResult, JhoveOptions, JhoveError, JhoveWarning } from '../types/jhove';

const DEFAULT_OPTIONS: JhoveOptions = {
  timeout: 60000,
  jhovePath: 'jhove', // Default to PATH
};

const BATCH_SIZE = 30;

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeJhovePath(value: string): string {
  if (!value) return value;

  let normalized = value.trim();

  if (normalized.startsWith('file:')) {
    try {
      normalized = fileURLToPath(normalized);
    } catch {
      normalized = normalized.replace(/^file:\/*/i, '');
    }
  }

  normalized = safeDecodeURIComponent(normalized);
  normalized = normalized.replace(/\\/g, '/');

  if (/^\/[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

export async function isJhoveInstalled(customPath?: string): Promise<boolean> {
  try {
    const cmd = customPath || DEFAULT_OPTIONS.jhovePath || 'jhove';
    // Just checking if we can spawn it. --version is not standard in all JHOVE versions but 'jhove' usually prints help.
    // We use a short timeout.
    const { stdout, stderr, exitCode } = await runJhoveCommand(cmd, [], 5000);
    // Exit code 0 is ideal, but even non-zero might mean it's installed but needs args.
    // If we get any output that looks like JHOVE, we are good.
    const output = stdout + stderr;
    return output.toLowerCase().includes('jhove') || output.length > 0;
  } catch (e) {
    return false;
  }
}

export async function getJhoveVersion(customPath?: string): Promise<string> {
  try {
    const cmd = customPath || DEFAULT_OPTIONS.jhovePath || 'jhove';
    const { stdout, stderr } = await runJhoveCommand(cmd, [], 5000);
    const output = stdout || stderr;
    const match = output.match(/JHOVE\s+(\d+\.\d+(\.\d+)?)/i) || output.match(/Rel\.\s+(\d+\.\d+(\.\d+)?)/i);
    return match ? match[1] : 'Unknown';
  } catch {
    throw new Error('JHOVE not installed or not found');
  }
}

export async function validateTiff(
  filepath: string,
  options: JhoveOptions = {}
): Promise<JhoveResult> {
  const batchResults = await validateTiffBatch([filepath], options);
  const result = batchResults.get(filepath);
  
  if (!result) {
    throw new Error(`Validation failed to produce result for ${filepath}`);
  }
  
  return result;
}

export async function validateTiffBatch(
  filepaths: string[],
  options: JhoveOptions = {}
): Promise<Map<string, JhoveResult>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results = new Map<string, JhoveResult>();
  
  if (filepaths.length === 0) return results;

  // Chunk the filepaths
  for (let i = 0; i < filepaths.length; i += BATCH_SIZE) {
    const chunk = filepaths.slice(i, i + BATCH_SIZE);
    try {
      const chunkResults = await processBatch(chunk, opts);
      for (const [path, res] of chunkResults) {
        results.set(path, res);
      }
    } catch (error: any) {
      // If a batch fails completely, mark all as errors
      console.error('JHOVE Batch Error:', error);
      for (const path of chunk) {
        results.set(path, {
          filepath: path,
          valid: false,
          wellFormed: false,
          status: 'error',
          errors: [],
          warnings: [],
          errorMessage: error.message || 'Batch processing failed'
        });
      }
    }
  }

  return results;
}

async function processBatch(
  filepaths: string[], 
  options: JhoveOptions
): Promise<Map<string, JhoveResult>> {
  // jhove -h xml -m TIFF-hul file1 file2 ...
  const args = ['-h', 'xml', '-m', 'TIFF-hul', ...filepaths];
  const cmd = options.jhovePath || 'jhove';
  
  const { stdout } = await runJhoveCommand(cmd, args, options.timeout || 60000);
  
  return parseJhoveXml(stdout, filepaths);
}

function parseJhoveXml(xml: string, originalPaths: string[]): Map<string, JhoveResult> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'message' || name === 'repInfo' || name === 'property' || name === 'value'
  });
  
  // Clean up XML if there's garbage before/after (sometimes JAVA tools print logs to stdout)
  const xmlStart = xml.indexOf('<jhove');
  const xmlEnd = xml.lastIndexOf('</jhove>');
  
  let validXml = xml;
  if (xmlStart >= 0 && xmlEnd > xmlStart) {
    validXml = xml.substring(xmlStart, xmlEnd + 8);
  } else if (xmlStart === -1) {
     throw new Error('No <jhove> tag found in output');
  }

  const parsed = parser.parse(validXml);
  const results = new Map<string, JhoveResult>();
  
  const repInfos = parsed.jhove?.repInfo;

  if (!repInfos) {
     // Even if no repInfo, it might be valid XML but empty? Unlikely for inputs.
     // Could happen if jhove failed to load module.
     throw new Error('Invalid JHOVE XML structure: missing repInfo');
  }
  
  const repInfoArray = Array.isArray(repInfos) ? repInfos : [repInfos];
  const normalizedOriginals = originalPaths.map((path) => ({
    path,
    normalized: normalizeJhovePath(path)
  }));

  for (const info of repInfoArray) {
    const uri = info['@_uri'];
    if (!uri) {
      continue;
    }
    const normalizedUri = normalizeJhovePath(uri);
    
    // Normalize URI to path mapping
    // JHOVE might return 'file:///path/to/img.tif' or absolute path
    // We try to find the matching input path.
    
    let matchingPath = normalizedOriginals.find(p => p.path === uri || p.normalized === normalizedUri);
    if (!matchingPath) {
      // Try fuzzy match
      matchingPath = normalizedOriginals.find(p => normalizedUri.endsWith(p.normalized) || p.normalized.endsWith(normalizedUri));
    }
    
    if (matchingPath) {
      const result = mapRepInfoToResult(matchingPath.path, info);
      results.set(matchingPath.path, result);
    }
  }

  // Ensure all requested files have a result
  for (const path of originalPaths) {
    if (!results.has(path)) {
      results.set(path, {
        filepath: path,
        valid: false,
        wellFormed: false,
        status: 'error',
        errors: [],
        warnings: [],
        errorMessage: 'File missing from JHOVE output'
      });
    }
  }

  return results;
}

function mapRepInfoToResult(filepath: string, info: any): JhoveResult {
  const statusStr = info.status || '';
  const normalizedStatus = statusStr.toString().toLowerCase();
  const format = info.format;
  const version = info.version;
  
  // Parse messages
  const messages = info.messages?.message || [];
  const msgArray = Array.isArray(messages) ? messages : [messages];
  
  const errors: JhoveError[] = [];
  const warnings: JhoveWarning[] = [];
  
  for (const msg of msgArray) {
    // msg might be string or object with '#text'
    const text = (msg['#text'] !== undefined ? msg['#text'] : msg).toString();
    const severity = (msg['@_severity'] || 'info').toString().toLowerCase();
    const offset = msg['@_offset'] ? parseInt(msg['@_offset'], 10) : undefined;
    
    if (severity === 'error') {
      errors.push({ message: text, offset });
    } else if (severity === 'warning') {
       warnings.push({ message: text });
    }
    // info severity ignored usually, unless we want to log it
  }

  // Determine status
  let status: JhoveResult['status'] = 'not-well-formed';
  let valid = false;
  let wellFormed = false;

  if (normalizedStatus === 'well-formed and valid') {
    status = 'valid';
    valid = true;
    wellFormed = true;
  } else if (normalizedStatus.includes('not well-formed') || normalizedStatus.includes('not well formed')) {
    status = 'not-well-formed';
    wellFormed = false;
    valid = false;
  } else if (normalizedStatus.includes('well-formed')) {
    status = 'not-valid'; // Well formed but not valid
    wellFormed = true;
    valid = false;
  } else {
    status = 'not-well-formed';
    wellFormed = false;
    valid = false;
  }

  return {
    filepath,
    valid,
    wellFormed,
    status,
    format,
    version,
    errors,
    warnings
  };
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runJhoveCommand(command: string, args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs) : null;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`JHOVE timed out after ${timeoutMs}ms`));
        return;
      }
      
      resolve({
        stdout,
        stderr,
        exitCode: typeof code === 'number' ? code : 0
      });
    });
  });
}
