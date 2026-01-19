import { readdir, stat, unlink } from "node:fs/promises";
import { join, basename } from "path";

export type SystemFileType =
  | 'ds_store'
  | 'thumbs_db'
  | 'desktop_ini'
  | 'apple_double'
  | 'spotlight'
  | 'trash'
  | 'unknown';

export interface CleanupFile {
  path: string;
  type: SystemFileType;
  size: number;
  removed: boolean;
  error?: string;
}

export interface CleanupResult {
  scanned: number;
  removed: number;
  failed: number;
  files: CleanupFile[];
  totalSize: number; // bytes freed
}

export interface CleanupOptions {
  dryRun?: boolean;
  recursive?: boolean;
  includeHidden?: boolean; // Usually system files are hidden, so this might mean "search in hidden folders too" or "search hidden files"
  // PRD says "Find all system files", usually hidden ones.
}

const SYSTEM_FILES_MAP: Record<string, SystemFileType> = {
  '.DS_Store': 'ds_store',
  '.Spotlight-V100': 'spotlight',
  '.Trashes': 'trash',
  '.fseventsd': 'spotlight',
  'Thumbs.db': 'thumbs_db',
  'ehthumbs.db': 'thumbs_db',
  'desktop.ini': 'desktop_ini',
  '.directory': 'desktop_ini'
};

function getSystemFileType(filename: string): SystemFileType | null {
  if (SYSTEM_FILES_MAP[filename]) {
    return SYSTEM_FILES_MAP[filename];
  }
  if (filename.startsWith('._')) {
    return 'apple_double';
  }
  return null;
}

export async function scanSystemFiles(
  dirPath: string,
  options: CleanupOptions = {}
): Promise<CleanupFile[]> {
  const { recursive = true } = options;
  const files: CleanupFile[] = [];

  async function scan(currentDir: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          if (recursive) {
             // Should we skip known system dirs like .Trashes if we are going to remove them?
             // If we encounter .Trashes, it is a system file (dir).
             const type = getSystemFileType(entry.name);
             if (type) {
                // It's a system directory (like .Trashes)
                // We should probably list it as a file to be removed?
                // PRD implies removing files. Removing directories might be dangerous if they contain things.
                // But .Spotlight-V100 is a dir.
                // Let's assume we treat system directories as single entities to remove.
                const stats = await stat(fullPath);
                files.push({
                  path: fullPath,
                  type,
                  size: stats.size, // Size of dir entry, not recursive size?
                  removed: false
                });
             } else {
                await scan(fullPath);
             }
          }
        } else if (entry.isFile()) {
          const type = getSystemFileType(entry.name);
          if (type) {
            const stats = await stat(fullPath);
            files.push({
              path: fullPath,
              type,
              size: stats.size,
              removed: false
            });
          }
        }
      }
    } catch (e) {
      console.warn(`Error scanning ${currentDir}:`, e);
    }
  }

  await scan(dirPath);
  return files;
}

export async function removeSystemFiles(
  dirPath: string,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const { dryRun = true } = options; // Default to dryRun for safety per PRD
  const files = await scanSystemFiles(dirPath, options);
  
  const result: CleanupResult = {
    scanned: 0, // Total files scanned? Or total system files found? "Found 47 system files".
    removed: 0,
    failed: 0,
    files: [],
    totalSize: 0
  };

  // We only track system files in result.files
  
  for (const file of files) {
    result.scanned++;
    result.totalSize += file.size;
    
    const resFile: CleanupFile = { ...file };
    
    if (!dryRun) {
      try {
        // Check if it's a directory or file (scan result doesn't say explicitly but we can stat or try rm -rf logic)
        // But we want to use `rm` with recursive if dir.
        // `unlink` only files.
        // `rm` works for both in node/bun.
        // `fs.rm(path, { recursive: true, force: true })`
        // But let's check what it is to be safe?
        // Actually scanSystemFiles identified it.
        // If it was a dir, we pushed it.
        
        // Wait, import `rm` from `node:fs/promises`
        const { rm } = await import("node:fs/promises");
        await rm(file.path, { recursive: true, force: true });
        resFile.removed = true;
        result.removed++;
      } catch (e: any) {
        resFile.removed = false;
        resFile.error = e.message;
        result.failed++;
      }
    } else {
      // Dry run
      resFile.removed = false;
    }
    
    result.files.push(resFile);
  }

  return result;
}
