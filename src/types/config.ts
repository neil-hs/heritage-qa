export type FileType = 'TIFF' | 'RAW' | 'JPEG' | 'PNG';
export type BitDepth = 8 | 16 | 32;
export type Severity = 'critical' | 'fixable' | 'warning';
export type ValidationStatus = 'pass' | 'fail' | 'warning' | 'skip';

export interface RequiredExifTag {
  tag: string;
  expected_value?: string;
  allow_variations?: boolean;
}

export interface ProjectSpec {
  project: {
    name: string;
    client?: string;
    description?: string;
    date?: string;
  };
  format: {
    file_type: FileType;
    allowed_extensions: string[];
    enforce_single_type?: boolean;
    compression?: string;
    raw_format?: string;
  };
  dimensions?: {
    min_long_edge?: number;
    min_short_edge?: number;
    max_long_edge?: number;
    max_short_edge?: number;
    exact_dimensions?: boolean;
  };
  color?: {
    bit_depth: BitDepth;
    color_space?: string;
    icc_profile?: string;
  };
  required_exif?: RequiredExifTag[];
  validation: {
    run_jhove: boolean;
    check_raw_validity?: boolean;
    mixed_formats?: boolean;
  };
  naming?: {
    pattern?: string;
    allow_spaces?: boolean;
    required_prefix?: string;
  };
}
