import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { compareRuns } from "../../src/utils/compare-validations";
import { initDatabase, closeDatabase } from "../../src/utils/db-schema";
import { existsSync, unlinkSync } from "fs";

const TEST_DB = "test_compare.db";

describe("Validation Comparison", () => {
  let db: Database;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = initDatabase(TEST_DB);
    
    // Seed runs
    db.run("INSERT INTO validation_runs (id, version, started_at) VALUES (1, 1, ?)", [new Date().toISOString()]);
    db.run("INSERT INTO validation_runs (id, version, started_at) VALUES (2, 2, ?)", [new Date().toISOString()]);

    // Seed images
    db.run("INSERT INTO images (id, filepath, filename, extension, file_type) VALUES (1, '/path/fixed.tif', 'fixed.tif', '.tif', 'TIFF')");
    db.run("INSERT INTO images (id, filepath, filename, extension, file_type) VALUES (2, '/path/broken.tif', 'broken.tif', '.tif', 'TIFF')");
    db.run("INSERT INTO images (id, filepath, filename, extension, file_type) VALUES (3, '/path/newfail.tif', 'newfail.tif', '.tif', 'TIFF')");

    // Run 1 Results
    // Image 1: Fail -> Fixable
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (1, 1, 'exif', 'fail', 'fixable', 'bad tag')");
    // Image 2: Fail -> Critical
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (2, 1, 'dimension', 'fail', 'critical', 'too small')");
    // Image 3: Pass
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (3, 1, 'exif', 'pass', null, 'ok')");

    // Run 2 Results
    // Image 1: Pass (Fixed)
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (1, 2, 'exif', 'pass', null, 'ok')");
    // Image 2: Fail (Still Failing)
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (2, 2, 'dimension', 'fail', 'critical', 'too small')");
    // Image 3: Fail (New Failure)
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (3, 2, 'exif', 'fail', 'fixable', 'new bad tag')");
  });

  afterEach(() => {
    closeDatabase(db);
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it("detects fixed images", async () => {
    const result = await compareRuns(db, 1, 2);
    expect(result.summary.fixed).toBe(1);
    expect(result.fixed[0].filename).toBe("fixed.tif");
  });

  it("detects new failures", async () => {
    const result = await compareRuns(db, 1, 2);
    expect(result.summary.newFailures).toBe(1);
    expect(result.newFailures[0].filename).toBe("newfail.tif");
  });

  it("detects still failing", async () => {
    const result = await compareRuns(db, 1, 2);
    expect(result.summary.stillFailing).toBe(1);
    expect(result.stillFailing[0].filename).toBe("broken.tif");
  });

  it("calculates net change", async () => {
    const result = await compareRuns(db, 1, 2);
    // 1 fixed - 1 new failure = 0
    expect(result.summary.netChange).toBe(0);
  });
});
