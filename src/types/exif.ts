import { FileType } from './config';

export interface ExifData {
  ImageWidth?: number;
  ImageHeight?: number;
  BitsPerSample?: number | number[];
  ColorSpace?: string | number;
  ICCProfile?: string;
  ICCProfileName?: string;
  Make?: string;
  Model?: string;
  Artist?: string;
  DateTime?: string;
  DateTimeOriginal?: string;
  Software?: string;
  ImageDescription?: string;
  Copyright?: string;
  [key: string]: unknown;
}

export interface ImageInfo {
  id: number;
  filepath: string;
  filename: string;
  extension: string;
  fileType: FileType;
  fileSize: number;
  exif?: ExifData;
}
