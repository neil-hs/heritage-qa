import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExifToolResult, ExifToolOptions } from '../types/extraction';
import { ExifData } from '../types/exif';

export async function isExifToolInstalled(): Promise<boolean> {
  try {
    await runExifTool(['-ver'], DEFAULT_OPTIONS.timeout);
    return true;
  } catch {
    return false;
  }
}

export async function getExifToolVersion(): Promise<string> {
  try {
    const { stdout } = await runExifTool(['-ver'], DEFAULT_OPTIONS.timeout);
    return stdout.trim();
  } catch {
    throw new Error('ExifTool not installed');
  }
}

const DEFAULT_OPTIONS: ExifToolOptions = {
  timeout: 30000,
};

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function buildBaseArgs(options: ExifToolOptions): string[] {
  const args = ['-json', '-G1', '-n'];
  const tags = options.tags?.map(tag => tag.trim()).filter(Boolean) ?? [];
  for (const tag of tags) {
    args.push(tag.startsWith('-') ? tag : `-${tag}`);
  }
  return args;
}

async function runExifTool(args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('exiftool', args, {
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
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (timedOut) {
        reject(new Error(`ExifTool timed out after ${timeoutMs}ms`));
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

export async function extractExif(
  filepath: string,
  options: ExifToolOptions = {}
): Promise<ExifToolResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const args = [...buildBaseArgs(opts), filepath];
    const { stdout, stderr, exitCode } = await runExifTool(args, opts.timeout ?? DEFAULT_OPTIONS.timeout);

    let data: any[] = [];
    try {
      data = JSON.parse(stdout);
    } catch {
      return { success: false, error: 'Failed to parse ExifTool JSON output', rawOutput: stdout };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, error: stderr || 'No data returned', rawOutput: stdout };
    }

    if (exitCode !== 0 && stderr) {
      return { success: true, data: data[0] as ExifData, rawOutput: stderr };
    }

    return { success: true, data: data[0] as ExifData, rawOutput: stderr || undefined };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { success: false, error: 'ExifTool not installed' };
    }
    return { 
      success: false, 
      error: error.message || 'ExifTool execution failed', 
      rawOutput: error.stderr || error.stdout 
    };
  }
}

export async function extractExifBatch(
  filepaths: string[],
  options: ExifToolOptions = {}
): Promise<Map<string, ExifToolResult>> {
  if (filepaths.length === 0) return new Map();

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const tempPath = join(tmpdir(), `exiftool_args_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
  
  // Write paths to temp file, one per line
  await Bun.write(tempPath, filepaths.join('\n'));

  try {
    // -json: JSON output
    // -G1: Include group names
    // -n: Numeric values
    // -@: Read args from file
    const args = [...buildBaseArgs(opts), '-@', tempPath];
    const { stdout, stderr, exitCode } = await runExifTool(args, opts.timeout ?? DEFAULT_OPTIONS.timeout);

    const results = new Map<string, ExifToolResult>();
    
    // Parse output
    let parsedData: any[] = [];
    try {
      parsedData = JSON.parse(stdout);
    } catch (e) {
      // If JSON parse fails, all failed
      const errorMsg = 'Failed to parse ExifTool JSON output';
      for (const fp of filepaths) {
        const rawOutput = stderr || stdout.substring(0, 1000);
        results.set(fp, { success: false, error: errorMsg, rawOutput });
      }
      return results;
    }

    // Index by SourceFile
    const dataMap = new Map<string, any>();
    for (const item of parsedData) {
      if (item.SourceFile) {
        // ExifTool returns SourceFile path, which should match our input path
        // but we need to be careful about matching exact strings if ExifTool normalized them
        dataMap.set(item.SourceFile, item);
      }
    }

    // Build results for all requested files
    for (const fp of filepaths) {
      // Try exact match first
      let data = dataMap.get(fp);
      
      // If not found, try to find by matching end of path (ExifTool might return absolute paths)
      if (!data) {
        for (const [key, val] of dataMap.entries()) {
           if (key.endsWith(fp) || fp.endsWith(key)) {
             data = val;
             break;
           }
        }
      }

      if (data) {
        const rawOutput = exitCode !== 0 ? stderr : undefined;
        results.set(fp, { success: true, data: data as ExifData, rawOutput });
      } else {
        const errorMsg = exitCode !== 0 && stderr ? stderr : 'No data returned for this file';
        results.set(fp, { success: false, error: errorMsg, rawOutput: stderr || undefined });
      }
    }

    return results;

  } catch (error: any) {
    // If the command itself failed
    const results = new Map<string, ExifToolResult>();
    for (const fp of filepaths) {
      const errorMsg = error?.code === 'ENOENT' ? 'ExifTool not installed' : (error.message || 'ExifTool batch execution failed');
      results.set(fp, { success: false, error: errorMsg, rawOutput: error.stderr || error.stdout });
    }
    return results;
  } finally {
    // Cleanup temp file
    try {
      await unlink(tempPath);
    } catch {} // Ignore errors during cleanup
  }
}
