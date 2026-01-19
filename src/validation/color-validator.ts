import { ExifData } from '../types/exif';
import { ProjectSpec, Severity } from '../types/config';

export interface ColorFailure {
  check: 'bit_depth' | 'color_space' | 'icc_profile';
  expected: string | number;
  actual: string | number;
  severity: Severity;
}

export interface ColorCheckResult {
  passed: boolean;
  bitDepth?: number | number[];
  colorSpace?: string | number;
  iccProfile?: string;
  failures: ColorFailure[];
}

const COLOR_SPACE_MAP: Record<number, string> = {
  1: 'sRGB',
  2: 'Adobe RGB (1998)',
  65535: 'Uncalibrated'
};

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchColorSpace(actual: string, expected: string): boolean {
  const normActual = normalizeString(actual);
  const normExpected = normalizeString(expected);

  // Direct match after normalization
  if (normActual === normExpected) return true;

  // Common aliases
  if (normExpected.includes('adobergb') && normActual.includes('adobergb')) return true;
  if (normExpected === 'srgb' && normActual.includes('srgb')) return true;

  return false;
}

export function validateColor(
  exif: ExifData,
  spec: ProjectSpec['color']
): ColorCheckResult {
  if (!spec) {
    return { passed: true, failures: [] };
  }

  const failures: ColorFailure[] = [];
  
  // Bit Depth
  // BitsPerSample can be single value or array (e.g. [8, 8, 8])
  // We usually care about the depth per channel being equal to the spec
  let bitDepth = exif.BitsPerSample;
  let bitDepthVal: number | undefined;

  if (Array.isArray(bitDepth)) {
    // Assuming uniform bit depth for all channels for now
    bitDepthVal = bitDepth[0];
  } else {
    bitDepthVal = bitDepth;
  }

  if (spec.bit_depth && bitDepthVal !== undefined && bitDepthVal !== spec.bit_depth) {
    failures.push({
      check: 'bit_depth',
      expected: spec.bit_depth,
      actual: Array.isArray(bitDepth) ? bitDepth.join(',') : bitDepthVal,
      severity: 'critical' // lossy to change
    });
  }

  // Color Space
  let colorSpace = exif.ColorSpace;
  let colorSpaceName: string = '';

  if (typeof colorSpace === 'number') {
    colorSpaceName = COLOR_SPACE_MAP[colorSpace] || `Unknown (${colorSpace})`;
  } else if (typeof colorSpace === 'string') {
    colorSpaceName = colorSpace;
  }

  if (spec.color_space) {
    if (!colorSpaceName) {
       // If color space is required but missing/unknown
       failures.push({
         check: 'color_space',
         expected: spec.color_space,
         actual: 'missing',
         severity: 'fixable'
       });
    } else if (!matchColorSpace(colorSpaceName, spec.color_space)) {
      failures.push({
        check: 'color_space',
        expected: spec.color_space,
        actual: colorSpaceName,
        severity: 'fixable'
      });
    }
  }

  // ICC Profile
  // ExifTool usually provides 'ProfileDescription' or 'ICCProfileName'
  // our ExifData type has ICCProfileName (added in previous step)
  const iccProfile = exif.ICCProfileName || exif.ProfileDescription as string;

  if (spec.icc_profile) {
    if (!iccProfile) {
        failures.push({
            check: 'icc_profile',
            expected: spec.icc_profile,
            actual: 'missing',
            severity: 'fixable'
        });
    } else if (iccProfile !== spec.icc_profile) {
       // Maybe we should normalize here too? The PRD says "exif.ICCProfileName !== spec.icc_profile" implies exact match
       // But often ICC profile names have small variations.
       // For now, exact match as per PRD snippet.
       failures.push({
         check: 'icc_profile',
         expected: spec.icc_profile,
         actual: iccProfile,
         severity: 'fixable'
       });
    }
  }

  return {
    passed: failures.length === 0,
    bitDepth: bitDepth,
    colorSpace: colorSpaceName || colorSpace,
    iccProfile,
    failures
  };
}
