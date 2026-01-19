import { RawValidationResult, RawCheck, RawValidationOptions } from '../types/raw';
import { ExifData } from '../types/exif';
import { extractExif } from '../extraction/exiftool';
import { stat } from 'node:fs/promises';

const RAW_CHECKS = [
  {
    name: 'file_readable',
    check: async (path: string) => {
      try {
        const stats = await stat(path);
        return stats.size > 0;
      } catch {
        return false;
      }
    },
    message: 'File cannot be read or is empty'
  },
  {
    name: 'has_exif',
    check: async (path: string, exif?: ExifData) => {
      return !!exif && Object.keys(exif).length > 0;
    },
    message: 'No EXIF data found'
  },
  {
    name: 'has_dimensions',
    check: async (path: string, exif?: ExifData) => {
      // Check standard tags first, then typical Composite tags
      const width = exif?.['System:ImageWidth'] || exif?.['File:ImageWidth'] || exif?.['ExifIFD:ImageWidth'] || exif?.['IFD0:ImageWidth'] || exif?.ImageWidth;
      const height = exif?.['System:ImageHeight'] || exif?.['File:ImageHeight'] || exif?.['ExifIFD:ImageHeight'] || exif?.['IFD0:ImageHeight'] || exif?.ImageHeight;
      return !!(width && height);
    },
    message: 'Missing image dimensions'
  },
  {
    name: 'camera_metadata',
    check: async (path: string, exif?: ExifData) => {
      const make = exif?.['IFD0:Make'] || exif?.['ExifIFD:Make'] || exif?.Make;
      const model = exif?.['IFD0:Model'] || exif?.['ExifIFD:Model'] || exif?.Model;
      return !!(make || model);
    },
    message: 'Missing camera Make/Model metadata'
  }
];

export async function validateRaw(
  filepath: string,
  options: RawValidationOptions = {}
): Promise<RawValidationResult> {
  let exifData = options.exifData;

  // Extract EXIF if not provided
  if (!exifData) {
    const result = await extractExif(filepath);
    if (result.success) {
      exifData = result.data;
    }
  }

  const checks: RawCheck[] = [];
  let allPassed = true;
  let format = 'UNKNOWN';

  // Determine format from extension or EXIF
  if (exifData) {
    // Try to get format from MIME type or FileType
    format = (exifData['File:FileType'] || exifData.FileType || 'UNKNOWN').toString();
  } else {
    // Fallback to extension
    const ext = filepath.split('.').pop()?.toUpperCase();
    if (ext) format = ext;
  }

  for (const checkDef of RAW_CHECKS) {
    let passed = false;
    try {
      passed = await checkDef.check(filepath, exifData);
    } catch (e) {
      passed = false;
    }

    if (!passed) allPassed = false;

    checks.push({
      name: checkDef.name,
      passed,
      message: passed ? undefined : checkDef.message
    });
  }

  return {
    filepath,
    valid: allPassed,
    format,
    checks,
    timestamp: new Date().toISOString()
  };
}

export async function validateRawBatch(
  files: Array<{ path: string; exif?: ExifData }>
): Promise<Map<string, RawValidationResult>> {
  const results = new Map<string, RawValidationResult>();

  // Process sequentially for now, could be parallelized
  // But usually called within a larger flow that handles concurrency
  for (const file of files) {
    const result = await validateRaw(file.path, { exifData: file.exif });
    results.set(file.path, result);
  }

  return results;
}
