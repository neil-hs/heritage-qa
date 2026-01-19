import { describe, it, expect } from 'bun:test';
import { validateColor } from '../../src/validation/color-validator';
import { ExifData } from '../../src/types/exif';
import { ProjectSpec } from '../../src/types/config';

describe('Color Validator', () => {
  const spec: ProjectSpec['color'] = {
    bit_depth: 8,
    color_space: 'Adobe RGB (1998)',
    icc_profile: 'Adobe RGB (1998)'
  };

  it('should pass valid color data', () => {
    const exif: ExifData = {
      BitsPerSample: 8,
      ColorSpace: 2, // Adobe RGB
      ICCProfileName: 'Adobe RGB (1998)'
    };
    const result = validateColor(exif, spec);
    expect(result.passed).toBe(true);
  });

  it('should pass valid color data with array bit depth', () => {
    const exif: ExifData = {
      BitsPerSample: [8, 8, 8],
      ColorSpace: 'Adobe RGB (1998)',
      ICCProfileName: 'Adobe RGB (1998)'
    };
    const result = validateColor(exif, spec);
    expect(result.passed).toBe(true);
  });

  it('should fail invalid bit depth (critical)', () => {
    const exif: ExifData = {
      BitsPerSample: 16,
      ColorSpace: 2,
      ICCProfileName: 'Adobe RGB (1998)'
    };
    const result = validateColor(exif, spec);
    expect(result.passed).toBe(false);
    expect(result.failures[0].check).toBe('bit_depth');
    expect(result.failures[0].severity).toBe('critical');
  });

  it('should fail invalid color space (fixable)', () => {
    const exif: ExifData = {
      BitsPerSample: 8,
      ColorSpace: 1, // sRGB
      ICCProfileName: 'sRGB IEC61966-2.1'
    };
    const result = validateColor(exif, spec);
    expect(result.passed).toBe(false);
    const csFailure = result.failures.find(f => f.check === 'color_space');
    expect(csFailure).toBeDefined();
    expect(csFailure?.severity).toBe('fixable');
  });

  it('should match fuzzy color space names', () => {
    const fuzzySpec: ProjectSpec['color'] = { ...spec, color_space: 'AdobeRGB' };
    const exif: ExifData = {
      BitsPerSample: 8,
      ColorSpace: 'Adobe RGB (1998)',
      ICCProfileName: 'Adobe RGB (1998)'
    };
    const result = validateColor(exif, fuzzySpec);
    expect(result.passed).toBe(true);
  });
});
