import { FileType } from './config';

export interface ExifData {
  ImageWidth?: number;
  ImageHeight?: number;
  BitsPerSample?: number;
  ColorSpace?: string;
  ICCProfile?: string;
  Make?: string;
  Model?: string;
  Artist?: string;
  DateTime?: string;
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
