import { describe, it, expect, beforeEach, afterEach, beforeAll } from "bun:test";
import { scanSystemFiles, removeSystemFiles, CleanupResult } from "../../src/cleanup/system-cleanup";
import { mkdir, writeFile, rm, rmdir } from "node:fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const TEST_DIR = "test_cleanup_dir";

describe("System Cleanup", () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR);
    await mkdir(join(TEST_DIR, "subdir"));
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("scans system files", async () => {
    // Create system files
    await writeFile(join(TEST_DIR, ".DS_Store"), "junk");
    await writeFile(join(TEST_DIR, "image.tif"), "image");
    await writeFile(join(TEST_DIR, "subdir", "Thumbs.db"), "junk");

    const files = await scanSystemFiles(TEST_DIR);
    
    expect(files.length).toBe(2);
    expect(files.find(f => f.path.endsWith(".DS_Store"))).toBeDefined();
    expect(files.find(f => f.path.endsWith("Thumbs.db"))).toBeDefined();
    expect(files.find(f => f.path.endsWith("image.tif"))).toBeUndefined();
  });

  it("removes system files (not dry run)", async () => {
    await writeFile(join(TEST_DIR, ".DS_Store"), "junk");
    
    const result = await removeSystemFiles(TEST_DIR, { dryRun: false });
    
    expect(result.removed).toBe(1);
    expect(existsSync(join(TEST_DIR, ".DS_Store"))).toBe(false);
  });

  it("dry run does not remove files", async () => {
    await writeFile(join(TEST_DIR, ".DS_Store"), "junk");
    
    const result = await removeSystemFiles(TEST_DIR, { dryRun: true });
    
    expect(result.removed).toBe(0);
    expect(existsSync(join(TEST_DIR, ".DS_Store"))).toBe(true);
  });
});
