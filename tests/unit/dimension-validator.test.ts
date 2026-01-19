import { describe, it, expect } from 'bun:test';
import { validateDimensions } from '../../src/validation/dimension-validator';
import { ExifData } from '../../src/types/exif';
import { ProjectSpec } from '../../src/types/config';

describe('Dimension Validator', () => {
  const spec: ProjectSpec['dimensions'] = {
    min_long_edge: 3000,
    max_long_edge: 6000,
    min_short_edge: 2000,
    max_short_edge: 4000
  };

  it('should pass valid dimensions', () => {
    const exif: ExifData = {
      ImageWidth: 4000,
      ImageHeight: 3000
    };
    // Long: 4000 (3000-6000), Short: 3000 (2000-4000)
    const result = validateDimensions(exif, spec);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('should fail if too small (critical)', () => {
    const exif: ExifData = {
      ImageWidth: 1000,
      ImageHeight: 800
    };
    const result = validateDimensions(exif, spec);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(2); // min_long and min_short
    expect(result.failures[0].severity).toBe('critical');
  });

  it('should fail if too large (fixable)', () => {
    const exif: ExifData = {
      ImageWidth: 8000,
      ImageHeight: 6000
    };
    const result = validateDimensions(exif, spec);
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.check === 'max_long_edge')).toBe(true);
    expect(result.failures.some(f => f.severity === 'fixable')).toBe(true);
  });

  it('should handle missing dimensions', () => {
    const exif: ExifData = {};
    const result = validateDimensions(exif, spec);
    expect(result.passed).toBe(false);
    expect(result.failures[0].check).toBe('missing_dimensions');
    expect(result.failures[0].severity).toBe('critical');
  });
});
