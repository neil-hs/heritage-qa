import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { validateImage, validateBatch } from '../../src/validation/spec-validator';
import { initDatabase, closeDatabase } from '../../src/utils/db-schema';
import { insertImage, insertExifData } from '../../src/utils/query-helpers';
import { ProjectSpec } from '../../src/types/config';
import { ImageInfo } from '../../src/types/exif';
import { ProgressState } from '../../src/utils/progress-tracker';

describe('Spec Validator (Orchestrator)', () => {
  let db: Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase(db);
  });

  const spec: ProjectSpec = {
    project: { name: 'Test' },
    format: { file_type: 'TIFF', allowed_extensions: ['tif'] },
    dimensions: { min_long_edge: 1000 },
    color: { bit_depth: 8, color_space: 'sRGB' },
    required_exif: [{ tag: 'Artist' }],
    validation: { run_jhove: false }
  };

  it('should validate a single image successfully', async () => {
    // Setup DB
    const imageId = insertImage(db, {
      filepath: '/tmp/test.tif',
      filename: 'test.tif',
      extension: 'tif',
      file_type: 'TIFF',
      file_size: 1000
    });

    insertExifData(db, imageId, {
      'ImageWidth': '1500',
      'ImageHeight': '1000',
      'BitsPerSample': '8',
      'ColorSpace': '1', // sRGB
      'Artist': 'Me'
    });

    const image: ImageInfo = {
      id: imageId,
      filepath: '/tmp/test.tif',
      filename: 'test.tif',
      extension: 'tif',
      fileType: 'TIFF',
      fileSize: 1000
    };
    
    // Note: image object here doesn't have exif, validateImage should fetch it
    
    const result = await validateImage(db, image, spec, 1);
    
    expect(result.passed).toBe(true);
    expect(result.checks.dimension?.passed).toBe(true);
    expect(result.checks.color?.passed).toBe(true);
    expect(result.checks.exifTags?.passed).toBe(true);
    
    // Check DB results
    const dbResults = db.query("SELECT * FROM validation_results WHERE image_id = $id").all({ $id: imageId });
    expect(dbResults.length).toBeGreaterThan(0);
  });

  it('should fail validation if specs not met', async () => {
    const imageId = insertImage(db, {
      filepath: '/tmp/fail.tif',
      filename: 'fail.tif',
      extension: 'tif',
      file_type: 'TIFF',
      file_size: 1000
    });

    insertExifData(db, imageId, {
      'ImageWidth': '500', // Too small
      'ImageHeight': '400',
      'BitsPerSample': '16', // Wrong depth
      'ColorSpace': '1',
      // Missing Artist
    });

    const image: ImageInfo = {
      id: imageId,
      filepath: '/tmp/fail.tif',
      filename: 'fail.tif',
      extension: 'tif',
      fileType: 'TIFF',
      fileSize: 1000
    };

    const result = await validateImage(db, image, spec, 1);
    
    expect(result.passed).toBe(false);
    expect(result.checks.dimension?.passed).toBe(false); // < 1000
    expect(result.checks.color?.passed).toBe(false); // 16 != 8
    expect(result.checks.exifTags?.passed).toBe(false); // Missing Artist
    expect(result.summary.failed).toBeGreaterThan(0);
  });
  
  it('should validate batch', async () => {
     const id1 = insertImage(db, { filepath: '1.tif', filename: '1.tif', extension: 'tif', file_type: 'TIFF', file_size: 100 });
     insertExifData(db, id1, { ImageWidth: '2000', ImageHeight: '2000', BitsPerSample: '8', ColorSpace: '1', Artist: 'A' });
     
     const id2 = insertImage(db, { filepath: '2.tif', filename: '2.tif', extension: 'tif', file_type: 'TIFF', file_size: 100 });
     insertExifData(db, id2, { ImageWidth: '500', ImageHeight: '500', BitsPerSample: '8', ColorSpace: '1', Artist: 'A' });

     const images: ImageInfo[] = [
         { id: id1, filepath: '1.tif', filename: '1.tif', extension: 'tif', fileType: 'TIFF', fileSize: 100 },
         { id: id2, filepath: '2.tif', filename: '2.tif', extension: 'tif', fileType: 'TIFF', fileSize: 100 }
     ];

     const { results, summary } = await validateBatch(db, images, spec);
     
     expect(results).toHaveLength(2);
     expect(summary.total).toBe(2);
     expect(summary.passed).toBe(1);
     expect(summary.failed).toBe(1);
  });

  it('reports progress through callback', async () => {
      const id1 = insertImage(db, { filepath: 'progress-1.tif', filename: 'progress-1.tif', extension: 'tif', file_type: 'TIFF', file_size: 100 });
      insertExifData(db, id1, { ImageWidth: '2000', ImageHeight: '2000', BitsPerSample: '8', ColorSpace: '1', Artist: 'A' });

      const id2 = insertImage(db, { filepath: 'progress-2.tif', filename: 'progress-2.tif', extension: 'tif', file_type: 'TIFF', file_size: 100 });
      insertExifData(db, id2, { ImageWidth: '500', ImageHeight: '500', BitsPerSample: '8', ColorSpace: '1', Artist: 'A' });

      const images: ImageInfo[] = [
          { id: id1, filepath: 'progress-1.tif', filename: 'progress-1.tif', extension: 'tif', fileType: 'TIFF', fileSize: 100 },
          { id: id2, filepath: 'progress-2.tif', filename: 'progress-2.tif', extension: 'tif', fileType: 'TIFF', fileSize: 100 }
      ];

      const progressStates: ProgressState[] = [];

      await validateBatch(db, images, spec, {
        onProgress(state) {
          progressStates.push(state);
        }
      });

      expect(progressStates.length).toBeGreaterThan(1);
      const lastState = progressStates[progressStates.length - 1];
      expect(lastState.phase).toBe('completed');
      expect(lastState.total).toBe(2);
      expect(lastState.completed).toBe(2);
  });
});
