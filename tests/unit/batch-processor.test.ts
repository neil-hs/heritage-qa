import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { initDatabase, closeDatabase } from "../../src/utils/db-schema";
import { processImages, resumeProcessing } from "../../src/extraction/batch-processor";
import { FileInfo } from "../../src/types/extraction";
import {
  createFakeExifTool,
  prependPath,
  clearFakeExifToolEnv
} from "../helpers/fake-exiftool";

let tempDir: string;
let dbPath: string;
let db: ReturnType<typeof initDatabase>;
let restorePath: (() => void) | null = null;
let cleanupFake: (() => void) | null = null;

const files: FileInfo[] = [
  { path: "file-1.tif", filename: "file-1.tif", extension: ".tif", fileType: "TIFF", fileSize: 100 },
  { path: "file-2.tif", filename: "file-2.tif", extension: ".tif", fileType: "TIFF", fileSize: 200 },
  { path: "file-3.tif", filename: "file-3.tif", extension: ".tif", fileType: "TIFF", fileSize: 300 }
];

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "hq-batch-test-"));
  dbPath = join(tempDir, "test.db");
  db = initDatabase(dbPath);

  const fake = createFakeExifTool();
  cleanupFake = fake.cleanup;
  restorePath = prependPath(fake.binDir);
  clearFakeExifToolEnv();
});

afterEach(() => {
  closeDatabase(db);
  restorePath?.();
  cleanupFake?.();
  clearFakeExifToolEnv();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Batch processor", () => {
  it("should respect resumeFrom and skip files", async () => {
    const result = await processImages(db, files, { resumeFrom: 1, chunkSize: 2 });

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("should resume from progress file", async () => {
    const progressPath = join(tempDir, "progress.json");
    writeFileSync(progressPath, JSON.stringify({ lastProcessedIndex: 2 }), "utf8");

    const result = await resumeProcessing(db, progressPath, { files, chunkSize: 2 });

    expect(result.skipped).toBe(2);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
  });
});
