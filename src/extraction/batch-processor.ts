import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { FileInfo, BatchOptions, BatchResult } from "../types/extraction";
import { extractExifBatch } from "./exiftool";
import { ProgressState } from "../utils/progress-tracker";

const DEFAULT_OPTIONS: BatchOptions = {
  chunkSize: 100,
  concurrency: 1,
  resumeFrom: 0
};

export async function processImages(
  db: Database,
  files: FileInfo[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunkSize = opts.chunkSize || 100;
  const startIndex = Math.max(0, Math.min(opts.resumeFrom ?? 0, files.length));
  const filesToProcess = startIndex > 0 ? files.slice(startIndex) : files;
  
  const result: BatchResult = {
    processed: 0,
    failed: 0,
    skipped: startIndex,
    errors: [],
    duration: 0
  };

  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const progressErrors: ProgressState["errors"] = [];

  const progressState: ProgressState = {
    operation: "exif-extraction",
    phase: "processing",
    total: filesToProcess.length,
    completed: 0,
    failed: 0,
    startedAt,
    updatedAt: startedAt,
    errors: []
  };

  // Prepare statements
  const insertImage = db.prepare(`
    INSERT INTO images (filepath, filename, extension, file_type, file_size)
    VALUES ($filepath, $filename, $extension, $file_type, $file_size)
    ON CONFLICT(filepath) DO UPDATE SET
      filename=excluded.filename,
      extension=excluded.extension,
      file_type=excluded.file_type,
      file_size=excluded.file_size
    RETURNING id;
  `);

  const insertExif = db.prepare(`
    INSERT INTO exif_data (image_id, tag_name, tag_value)
    VALUES ($image_id, $tag_name, $tag_value)
    ON CONFLICT(image_id, tag_name) DO UPDATE SET
      tag_value=excluded.tag_value;
  `);

  // Clear existing EXIF for replaced images could be tricky with ON CONFLICT.
  // Ideally we should delete existing EXIF if image is updated.
  // For now, ON CONFLICT update is fine, but it won't remove tags that disappeared.
  // A cleaner way is DELETE FROM exif_data WHERE image_id = ? before inserting new tags.
  const deleteExif = db.prepare(`DELETE FROM exif_data WHERE image_id = $image_id`);

  const upsertImageWithExif = db.transaction((fileInfo: FileInfo, exifData: Record<string, unknown>) => {
    const row = insertImage.get({
      $filepath: fileInfo.path,
      $filename: fileInfo.filename,
      $extension: fileInfo.extension,
      $file_type: fileInfo.fileType,
      $file_size: fileInfo.fileSize
    }) as { id: number };

    const imageId = row.id;

    deleteExif.run({ $image_id: imageId });

    for (const [tag, value] of Object.entries(exifData)) {
      let strValue = '';
      if (typeof value === 'object' && value !== null) {
        strValue = JSON.stringify(value);
      } else {
        strValue = String(value);
      }

      insertExif.run({
        $image_id: imageId,
        $tag_name: tag,
        $tag_value: strValue
      });
    }
  });

  const recordFailure = (filepath: string, error: string) => {
    result.failed++;
    result.errors.push({ filepath, error });
    progressErrors.push({ file: filepath, error, timestamp: new Date().toISOString() });
  };

  const emitProgress = (currentFile?: string) => {
    progressState.completed = result.processed;
    progressState.failed = result.failed;
    progressState.currentFile = currentFile;
    progressState.updatedAt = new Date().toISOString();
    progressState.errors = [...progressErrors];

    const processedCount = result.processed + result.failed;
    if (processedCount > 0) {
      const elapsed = Date.now() - startTime;
      const rate = processedCount / Math.max(elapsed, 1);
      const remaining = progressState.total - processedCount;
      if (rate > 0 && remaining >= 0) {
        progressState.estimatedCompletion = new Date(Date.now() + remaining / rate).toISOString();
      }
    }

    if (opts.onProgress) {
      opts.onProgress({ ...progressState, errors: [...progressState.errors] });
    }
  };

  // Helper to process a chunk
  const processChunk = async (chunk: FileInfo[]) => {
    const filepaths = chunk.map(f => f.path);
    
    // Batch extract EXIF
    const exifResults = await extractExifBatch(filepaths);

    for (const fileInfo of chunk) {
      const exifResult = exifResults.get(fileInfo.path);

      if (!exifResult || !exifResult.success || !exifResult.data) {
        recordFailure(fileInfo.path, exifResult?.error || 'Unknown EXIF extraction error');
        emitProgress(fileInfo.path);
        continue;
      }

      try {
        upsertImageWithExif(fileInfo, exifResult.data as Record<string, unknown>);
        result.processed++;
      } catch (err: any) {
        recordFailure(fileInfo.path, err.message || 'Database insert failed');
      }

      emitProgress(fileInfo.path);
    }
  };

  // Process in chunks
  for (let i = 0; i < filesToProcess.length; i += chunkSize) {
    const chunk = filesToProcess.slice(i, i + chunkSize);
    
    try {
      await processChunk(chunk);
    } catch (err: any) {
      // If chunk processing fails (e.g. ExifTool crash), log it
      for (const file of chunk) {
        recordFailure(file.path, `Chunk execution failed: ${err.message}`);
        emitProgress(file.path);
      }
    }
  }

  result.duration = Date.now() - startTime;
  progressState.phase = "completed";
  emitProgress();
  return result;
}

export async function resumeProcessing(
  db: Database,
  progressPath: string,
  options: BatchOptions = {}
): Promise<BatchResult> {
  if (!existsSync(progressPath)) {
    throw new Error(`Progress file not found at ${progressPath}`);
  }

  const progressData = JSON.parse(readFileSync(progressPath, "utf-8"));
  const completed = Number(progressData.completed ?? 0);
  const failed = Number(progressData.failed ?? 0);
  const lastProcessedIndex = Number(progressData.lastProcessedIndex ?? NaN);
  const resumeFrom = Number.isFinite(lastProcessedIndex) ? lastProcessedIndex : completed + failed;

  const files = options.files;
  if (!files || files.length === 0) {
    throw new Error("resumeProcessing requires a file list via options.files");
  }

  return processImages(db, files, { ...options, resumeFrom });
}
