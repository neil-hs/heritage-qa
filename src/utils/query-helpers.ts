import { Database } from "bun:sqlite";
import { ImageInfo, ValidationResult, ValidationSummary, ValidationRun, FileType } from "../types";
import { ExifData } from "../types/exif";

// Helper input types matching DB schema
export interface ImageInput {
  filepath: string;
  filename: string;
  extension: string;
  file_type: string;
  file_size: number;
}

export interface ValidationResultInput {
  image_id: number;
  validation_run: number;
  check_type: string;
  status: string;
  severity?: string;
  message?: string;
  details?: string; // JSON string
}

export function insertImage(db: Database, image: ImageInput): number {
  const query = db.query(`
    INSERT INTO images (filepath, filename, extension, file_type, file_size)
    VALUES ($filepath, $filename, $extension, $file_type, $file_size)
    RETURNING id
  `);
  
  const result = query.get({
    $filepath: image.filepath,
    $filename: image.filename,
    $extension: image.extension,
    $file_type: image.file_type,
    $file_size: image.file_size
  }) as { id: number };
  
  return result.id;
}

export function insertExifData(db: Database, imageId: number, exif: Record<string, string>): void {
  const query = db.query(`
    INSERT INTO exif_data (image_id, tag_name, tag_value)
    VALUES ($image_id, $tag_name, $tag_value)
  `);
  
  const insert = db.transaction((tags: [string, string][]) => {
    for (const [tag, value] of tags) {
      query.run({
        $image_id: imageId,
        $tag_name: tag,
        $tag_value: value
      });
    }
  });
  
  insert(Object.entries(exif));
}

export function insertValidationResult(db: Database, result: ValidationResultInput): number {
    const query = db.query(`
        INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message, details)
        VALUES ($image_id, $validation_run, $check_type, $status, $severity, $message, $details)
        RETURNING id
    `);

    const res = query.get({
        $image_id: result.image_id,
        $validation_run: result.validation_run,
        $check_type: result.check_type,
        $status: result.status,
        $severity: result.severity || null,
        $message: result.message || null,
        $details: result.details || null
    }) as { id: number };

    return res.id;
}

export function getImageByPath(db: Database, filepath: string): ImageInfo | null {
    const row = db.query("SELECT * FROM images WHERE filepath = $filepath").get({ $filepath: filepath }) as any;
    if (!row) return null;
    return {
        id: row.id,
        filepath: row.filepath,
        filename: row.filename,
        extension: row.extension,
        fileType: row.file_type as FileType,
        fileSize: row.file_size
    };
}

export function getImageWithExif(db: Database, imageId: number): ImageInfo | null {
  const row = db.query("SELECT * FROM images WHERE id = $id").get({ $id: imageId }) as any;
  if (!row) return null;

  const exifRows = db.query("SELECT tag_name, tag_value FROM exif_data WHERE image_id = $id").all({ $id: imageId }) as { tag_name: string; tag_value: string }[];
  
  const exif: ExifData = {};
  for (const { tag_name, tag_value } of exifRows) {
    // Basic type conversion
    if (tag_name === 'ImageWidth' || tag_name === 'ImageHeight') {
      const val = parseInt(tag_value, 10);
      if (!isNaN(val)) exif[tag_name] = val;
    } else if (tag_name === 'BitsPerSample') {
      if (tag_value.includes(' ')) {
        const parts = tag_value.split(' ').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
        exif[tag_name] = parts;
      } else {
         const val = parseInt(tag_value, 10);
         if (!isNaN(val)) exif[tag_name] = val;
      }
    } else if (tag_name === 'ColorSpace') {
      const val = parseInt(tag_value, 10);
      // ColorSpace can be '1' or 'sRGB'. If numeric, store as number, else string.
      // But typically it's stored as string in DB. 
      // If it looks like a number, parse it?
      // PRD says: "1=sRGB". 
      if (!isNaN(val) && String(val) === tag_value) {
         exif[tag_name] = val;
      } else {
         exif[tag_name] = tag_value;
      }
    } else {
      exif[tag_name] = tag_value;
    }
  }

  return {
      id: row.id,
      filepath: row.filepath,
      filename: row.filename,
      extension: row.extension,
      fileType: row.file_type as FileType,
      fileSize: row.file_size,
      exif
  };
}

export function getFailedImages(db: Database, runId: number): any[] {
    return db.query(`
        SELECT i.*, v.check_type, v.message 
        FROM images i
        JOIN validation_results v ON i.id = v.image_id
        WHERE v.validation_run = $runId AND v.status = 'fail'
    `).all({ $runId: runId });
}

export function startValidationRun(db: Database, version: number, configHash: string): number {
    const query = db.query(`
        INSERT INTO validation_runs (version, config_hash)
        VALUES ($version, $configHash)
        RETURNING id
    `);
    const res = query.get({ $version: version, $configHash: configHash }) as { id: number };
    return res.id;
}

export function getValidationSummary(db: Database, runId: number): any {
    const summary = db.query(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warnings
        FROM validation_results
        WHERE validation_run = $runId
    `).get({ $runId: runId });
    return summary;
}
