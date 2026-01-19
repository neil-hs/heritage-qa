import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createFakeExifTool,
  prependPath,
  clearFakeExifToolEnv,
  setFakeExifToolEnv
} from "../helpers/fake-exiftool";
import {
  extractExif,
  extractExifBatch,
  getExifToolVersion,
  isExifToolInstalled
} from "../../src/extraction/exiftool";

let cleanup: (() => void) | null = null;
let restorePath: (() => void) | null = null;

beforeEach(() => {
  const fake = createFakeExifTool();
  cleanup = fake.cleanup;
  restorePath = prependPath(fake.binDir);
  clearFakeExifToolEnv();
});

afterEach(() => {
  restorePath?.();
  cleanup?.();
  clearFakeExifToolEnv();
});

describe("ExifTool wrapper", () => {
  it("should detect installation and return version", async () => {
    setFakeExifToolEnv({ version: "12.99" });

    const installed = await isExifToolInstalled();
    const version = await getExifToolVersion();

    expect(installed).toBe(true);
    expect(version).toBe("12.99");
  });

  it("should include requested tags", async () => {
    setFakeExifToolEnv({ requireTag: "-ImageWidth" });

    const result = await extractExif("file-a.tif", { tags: ["ImageWidth"] });

    expect(result.success).toBe(true);
    expect(result.data?.SourceFile).toBe("file-a.tif");
  });

  it("should return batch results on non-zero exit with JSON output", async () => {
    setFakeExifToolEnv({ exitCode: 1, stderr: "warning" });

    const files = ["file-1.tif", "file-2.tif"];
    const results = await extractExifBatch(files);

    expect(results.get(files[0])?.success).toBe(true);
    expect(results.get(files[1])?.success).toBe(true);
    expect(results.get(files[0])?.rawOutput?.includes("warning")).toBe(true);
  });
});
