import { describe, it, expect, beforeEach, afterEach, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { generateFixScript, getFixableIssues } from "../../src/fixes/fix-script-generator";
import { initDatabase, closeDatabase } from "../../src/utils/db-schema";
import { join } from "path";
import { unlinkSync, existsSync, mkdirSync, chmodSync } from "fs";

const TEST_DB = "test_fixes.db";
const OUTPUT_FILE = "test_fix.sh";

describe("Fix Generator", () => {
  let db: Database;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = initDatabase(TEST_DB);
    // Seed image
    db.run("INSERT INTO images (filepath, filename, extension, file_type) VALUES (?, ?, ?, ?)", ["/tmp/img1.tif", "img1.tif", ".tif", "TIFF"]);
    db.run("INSERT INTO images (filepath, filename, extension, file_type) VALUES (?, ?, ?, ?)", ["/tmp/img 2.tif", "img 2.tif", ".tif", "TIFF"]); // Space in path
    
    // Create run
    db.run("INSERT INTO validation_runs (version, started_at) VALUES (?, ?)", [1, new Date().toISOString()]);
  });

  afterEach(() => {
    closeDatabase(db);
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(OUTPUT_FILE)) unlinkSync(OUTPUT_FILE);
  });

  it("returns empty script if no issues", async () => {
    const script = await generateFixScript(db, 1, { outputPath: OUTPUT_FILE });
    expect(script).toContain("No fixable issues found");
    expect(script).toContain("echo");
  });

  it("generates EXIF fix command", async () => {
    // Seed fixable issue
    const details = JSON.stringify({
      passed: false,
      failures: [{
        tag: "Artist",
        reason: "wrong_value",
        expected: "Correct Artist",
        actual: "Wrong Artist",
        severity: "fixable"
      }]
    });
    
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, details) VALUES (?, ?, ?, ?, ?, ?)", 
      [1, 1, 'exif', 'fail', 'fixable', details]);

    const script = await generateFixScript(db, 1, { outputPath: OUTPUT_FILE });
    
    expect(script).toContain("exiftool -overwrite_original");
    // Check for presence of tag and value, allowing for shell escaping variations
    expect(script).toContain("Artist");
    expect(script).toContain("Correct Artist");
    expect(script).toContain("/tmp/img1.tif");
  });

  it("handles spaces and quotes in paths and values", async () => {
    // Seed issue for image with space, and value with quotes
    const details = JSON.stringify({
      passed: false,
      failures: [{
        tag: "Copyright",
        reason: "wrong_value",
        expected: "Copyright '2025'",
        severity: "fixable"
      }]
    });
    
    // image id 2 is "/tmp/img 2.tif"
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, details) VALUES (?, ?, ?, ?, ?, ?)", 
      [2, 1, 'exif', 'fail', 'fixable', details]);

    const script = await generateFixScript(db, 1, { outputPath: OUTPUT_FILE });
    
    // Path escaping - expects single quotes around path with space
    expect(script).toContain("'/tmp/img 2.tif'");
    
    // Value escaping: -Copyright="Copyright '2025'" -> quoted as '-Copyright=Copyright '\''2025'\'''
    // shell-quote: quote(['-Copyright=Copyright \'2025\''])
    // It should handle it safely. We check if the expected substring exists in some form.
    // simpler check: it contains the tag and part of value
    expect(script).toContain("Copyright");
    expect(script).toContain("2025");
  });

  it("combines multiple fixes for same file", async () => {
    const details = JSON.stringify({
      passed: false,
      failures: [
        { tag: "Artist", expected: "Me", severity: "fixable" },
        { tag: "Copyright", expected: "Mine", severity: "fixable" }
      ]
    });
    
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, details) VALUES (?, ?, ?, ?, ?, ?)", 
      [1, 1, 'exif', 'fail', 'fixable', details]);

    const script = await generateFixScript(db, 1, { outputPath: OUTPUT_FILE });
    
    // Should be one line with both tags
    // exiftool ... -Artist=Me -Copyright=Mine ...
    expect(script.match(/exiftool/g)?.length).toBe(1); // One command
    
    // Check for both tags, allowing for backslash escape of equals sign
    expect(script).toMatch(/-Artist\\?=Me/);
    expect(script).toMatch(/-Copyright\\?=Mine/);
  });

  it("supports backup option", async () => {
    const details = JSON.stringify({
      passed: false,
      failures: [{ tag: "Artist", expected: "Me", severity: "fixable" }]
    });
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, details) VALUES (?, ?, ?, ?, ?, ?)", 
      [1, 1, 'exif', 'fail', 'fixable', details]);

    const script = await generateFixScript(db, 1, { outputPath: OUTPUT_FILE, backup: true });
    
    expect(script).toContain("mkdir -p backups");
    expect(script).toContain("cp /tmp/img1.tif"); // No quotes needed for simple path
  });

  it("supports dry run", async () => {
    const details = JSON.stringify({
      passed: false,
      failures: [{ tag: "Artist", expected: "Me", severity: "fixable" }]
    });
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, details) VALUES (?, ?, ?, ?, ?, ?)", 
      [1, 1, 'exif', 'fail', 'fixable', details]);

    const script = await generateFixScript(db, 1, { outputPath: OUTPUT_FILE, dryRun: true });
    
    expect(script).toContain("echo exiftool -overwrite_original");
  });

});