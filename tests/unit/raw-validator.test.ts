import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";
import { validateRaw, validateRawBatch } from "../../src/validation/raw-validator";
import { ExifData } from "../../src/types/exif";

// Mock the dependencies
const mockStat = mock(() => Promise.resolve({ size: 1000 }));
mock.module("node:fs/promises", () => ({
  stat: mockStat
}));

const mockExtractExif = mock((filepath: string) => {
  if (filepath.includes("error")) {
    return Promise.resolve({ success: false, error: "Failed" });
  }
  return Promise.resolve({
    success: true,
    data: {
      "System:ImageWidth": 100,
      "System:ImageHeight": 100,
      "Make": "TestCam",
      "Model": "TestModel",
      "File:FileType": "DNG"
    } as any
  });
});

mock.module("../../src/extraction/exiftool", () => ({
  extractExif: mockExtractExif
}));

describe("RAW Validator", () => {
  beforeEach(() => {
    mockExtractExif.mockClear();
    mockStat.mockClear();
  });

  it("should pass a valid RAW file", async () => {
    const result = await validateRaw("test.dng");
    
    expect(result.valid).toBe(true);
    expect(result.format).toBe("DNG");
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it("should fail if file is empty (stat throws)", async () => {
    mockStat.mockRejectedValueOnce(new Error("ENOENT"));
    
    const result = await validateRaw("missing.dng");
    
    expect(result.valid).toBe(false);
    const readableCheck = result.checks.find(c => c.name === "file_readable");
    expect(readableCheck?.passed).toBe(false);
  });

  it("should fail if no EXIF data", async () => {
    mockExtractExif.mockResolvedValueOnce({ success: false });
    
    const result = await validateRaw("no-exif.dng");
    
    expect(result.valid).toBe(false);
    const exifCheck = result.checks.find(c => c.name === "has_exif");
    expect(exifCheck?.passed).toBe(false);
  });

  it("should fail if missing dimensions", async () => {
    mockExtractExif.mockResolvedValueOnce({
      success: true,
      data: { Make: "Cam" } as any
    });

    const result = await validateRaw("no-dims.dng");
    
    expect(result.valid).toBe(false);
    const dimCheck = result.checks.find(c => c.name === "has_dimensions");
    expect(dimCheck?.passed).toBe(false);
  });

  it("should use provided exif data", async () => {
    const providedExif: ExifData = {
      ImageWidth: 200,
      ImageHeight: 200,
      Make: "Sony",
      Model: "A7",
      FileType: "ARW"
    } as any;

    const result = await validateRaw("provided.arw", { exifData: providedExif });
    
    expect(result.valid).toBe(true);
    expect(result.format).toBe("ARW");
    expect(mockExtractExif).not.toHaveBeenCalled();
  });
});
