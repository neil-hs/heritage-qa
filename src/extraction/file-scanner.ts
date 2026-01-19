import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { FileType, ProjectSpec } from '../types/config';
import { FileInfo, ScanResult, ScanSummary } from '../types/extraction';

const FILE_TYPE_MAP: Record<string, FileType> = {
  '.tif': 'TIFF',
  '.tiff': 'TIFF',
  '.dng': 'RAW',
  '.arw': 'RAW',
  '.nef': 'RAW',
  '.cr2': 'RAW',
  '.cr3': 'RAW',
  '.orf': 'RAW',
  '.raw': 'RAW',
  '.raf': 'RAW',
  '.rw2': 'RAW',
  '.jpg': 'JPEG',
  '.jpeg': 'JPEG',
  '.png': 'PNG'
};

export function detectFileType(extension: string): FileType | null {
  const normalized = extension.toLowerCase();
  return FILE_TYPE_MAP[normalized] || null;
}

export function isImageFile(extension: string): boolean {
  return detectFileType(extension) !== null;
}

export async function scanDirectory(
  dirPath: string,
  config: ProjectSpec
): Promise<ScanResult> {
  const matched: FileInfo[] = [];
  const mismatched: FileInfo[] = [];
  const skipped: string[] = [];
  const byType: Record<FileType, number> = {
    TIFF: 0,
    RAW: 0,
    JPEG: 0,
    PNG: 0
  };

  async function scan(currentDir: string) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error);
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      const fileType = detectFileType(ext);

      if (!fileType) {
        skipped.push(fullPath);
        continue;
      }

      let stats;
      try {
        stats = await stat(fullPath);
      } catch (error) {
        console.error(`Error reading file stats for ${fullPath}:`, error);
        skipped.push(fullPath);
        continue;
      }
      const fileInfo: FileInfo = {
        path: fullPath,
        filename: entry.name,
        extension: ext,
        fileType: fileType,
        fileSize: stats.size
      };

      // Check against config
      const allowedExtensions = config.format.allowed_extensions.map(e => e.toLowerCase());
      const isAllowed = allowedExtensions.includes(ext);

      if (isAllowed) {
        matched.push(fileInfo);
        byType[fileType]++;
      } else {
        mismatched.push(fileInfo);
      }
    }
  }

  await scan(dirPath);

  // Sort matched files by filename for consistent processing order
  matched.sort((a, b) => a.filename.localeCompare(b.filename));

  const summary: ScanSummary = {
    totalMatched: matched.length,
    totalMismatched: mismatched.length,
    totalSkipped: skipped.length,
    byType
  };

  return {
    matched,
    mismatched,
    skipped,
    summary
  };
}
