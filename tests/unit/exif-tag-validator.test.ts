import { describe, it, expect } from 'bun:test';
import { validateExifTags } from '../../src/validation/exif-tag-validator';
import { ExifData } from '../../src/types/exif';
import { RequiredExifTag } from '../../src/types/config';

describe('EXIF Tag Validator', () => {
  const requiredTags: RequiredExifTag[] = [
    { tag: 'Artist' },
    { tag: 'Copyright', expected_value: 'Heritage Museum' },
    { tag: 'Make', expected_value: 'Sony', allow_variations: true }
  ];

  it('should pass if all tags present and correct', () => {
    const exif: ExifData = {
      Artist: 'John Doe',
      Copyright: 'Heritage Museum',
      Make: 'Sony Corporation'
    };
    const result = validateExifTags(exif, requiredTags);
    expect(result.passed).toBe(true);
  });

  it('should fail if tag missing', () => {
    const exif: ExifData = {
      Copyright: 'Heritage Museum',
      Make: 'Sony'
    };
    const result = validateExifTags(exif, requiredTags);
    expect(result.passed).toBe(false);
    expect(result.failures[0].tag).toBe('Artist');
    expect(result.failures[0].reason).toBe('missing');
  });

  it('should fail if value incorrect (exact)', () => {
    const exif: ExifData = {
      Artist: 'John Doe',
      Copyright: 'Wrong Copyright',
      Make: 'Sony'
    };
    const result = validateExifTags(exif, requiredTags);
    expect(result.passed).toBe(false);
    expect(result.failures[0].tag).toBe('Copyright');
    expect(result.failures[0].reason).toBe('wrong_value');
  });

  it('should pass if value matches with variations', () => {
    const exif: ExifData = {
      Artist: 'John Doe',
      Copyright: 'Heritage Museum',
      Make: 'SONY Corp.' // Contains 'Sony' (case insensitive check implemented as normalize().includes())
    };
    
    // Logic check: normalize('SONY Corp.') -> 'sony corp.'
    // normalize('Sony') -> 'sony'
    // 'sony corp.'.includes('sony') -> true.
    
    const result = validateExifTags(exif, requiredTags);
    expect(result.passed).toBe(true);
  });
});
