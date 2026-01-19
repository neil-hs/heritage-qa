import { describe, it, expect, beforeEach, afterEach, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { exportToCsv } from "../../src/reporting/csv-export";
import { generateMarkdownReport } from "../../src/reporting/markdown-report";
import { generateHtmlReport } from "../../src/reporting/html-report";
import { initDatabase, closeDatabase } from "../../src/utils/db-schema";
import { join } from "path";
import { unlinkSync, existsSync, mkdirSync, rmSync } from "fs";

const TEST_DB = "test_reporting.db";
const OUTPUT_DIR = "test_output";

describe("Reporting", () => {
  let db: Database;

  beforeAll(() => {
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR);
    }
    // Mock assets if they don't exist
    if (!existsSync("assets")) mkdirSync("assets");
    if (!existsSync("assets/sql-wasm.js")) Bun.write("assets/sql-wasm.js", "mock");
    if (!existsSync("assets/sql-wasm.wasm")) Bun.write("assets/sql-wasm.wasm", "mock");
  });

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = initDatabase(TEST_DB);
    // Seed data
    db.run("INSERT INTO images (filepath, filename, extension, file_type, file_size) VALUES (?, ?, ?, ?, ?)", ["/tmp/img1.tif", "img1.tif", ".tif", "TIFF", 1000]);
    db.run("INSERT INTO images (filepath, filename, extension, file_type, file_size) VALUES (?, ?, ?, ?, ?)", ["/tmp/img2.tif", "img2.tif", ".tif", "TIFF", 2000]);
    
    // Create run
    db.run("INSERT INTO validation_runs (version, started_at) VALUES (?, ?)", [1, new Date().toISOString()]);
    const runId = 1;
    
    // Results
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (?, ?, ?, ?, ?, ?)", [1, runId, 'dimension', 'pass', null, 'ok']);
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (?, ?, ?, ?, ?, ?)", [2, runId, 'dimension', 'fail', 'critical', 'too small']);
  });

  afterEach(() => {
    closeDatabase(db);
    // Cleanup output files
    if (existsSync(join(OUTPUT_DIR, "report.csv"))) unlinkSync(join(OUTPUT_DIR, "report.csv"));
    if (existsSync(join(OUTPUT_DIR, "summary.csv"))) unlinkSync(join(OUTPUT_DIR, "summary.csv"));
    if (existsSync(join(OUTPUT_DIR, "report.md"))) unlinkSync(join(OUTPUT_DIR, "report.md"));
    if (existsSync(join(OUTPUT_DIR, "report.html"))) unlinkSync(join(OUTPUT_DIR, "report.html"));
    if (existsSync(join(OUTPUT_DIR, "report_all.csv"))) unlinkSync(join(OUTPUT_DIR, "report_all.csv"));
    if (existsSync(join(OUTPUT_DIR, "report_config.md"))) unlinkSync(join(OUTPUT_DIR, "report_config.md"));
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync("project-spec.yaml")) unlinkSync("project-spec.yaml");
  });

  it("exports CSV", async () => {
    const outFile = join(OUTPUT_DIR, "report.csv");
    await exportToCsv(db, 1, { outputPath: outFile, type: 'failed' });
    expect(await Bun.file(outFile).exists()).toBe(true);
    const content = await Bun.file(outFile).text();
    expect(content).toContain("img2.tif");
    expect(content).toContain("too small");
    expect(content).not.toContain("img1.tif");
  });

  it("exports Summary CSV", async () => {
      const outFile = join(OUTPUT_DIR, "summary.csv");
      await exportToCsv(db, 1, { outputPath: outFile, type: 'summary' });
      const content = await Bun.file(outFile).text();
      expect(content).toContain("dimension");
      // Total 1 run. Wait, grouping by check_type.
      // img1: dimension pass. img2: dimension fail.
      // Total 2. Passed 1. Failed 1. Pass rate 50%.
      expect(content).toContain("50.0%");
  });

  it("exports 'all' CSV correctly filtering by runId", async () => {
    // Add data for another run
    const runId2 = 2;
    // Note: ID is AUTOINCREMENT, so inserting manually
    db.run("INSERT INTO validation_runs (version, started_at) VALUES (?, ?)", [2, new Date().toISOString()]);
    
    // Image 3 belongs to run 2
    db.run("INSERT INTO images (filepath, filename, extension, file_type, file_size) VALUES (?, ?, ?, ?, ?)", ["/tmp/img3.tif", "img3.tif", ".tif", "TIFF", 3000]);
    // Get its ID (should be 3)
    const img3 = db.query("SELECT id FROM images WHERE filename = 'img3.tif'").get() as any;
    
    db.run("INSERT INTO validation_results (image_id, validation_run, check_type, status, severity, message) VALUES (?, ?, ?, ?, ?, ?)", [img3.id, runId2, 'dimension', 'pass', null, 'ok']);

    const outFile = join(OUTPUT_DIR, "report_all.csv");
    await exportToCsv(db, 1, { outputPath: outFile, type: 'all' });
    const content = await Bun.file(outFile).text();
    
    // Should contain run 1 images
    expect(content).toContain("img1.tif");
    expect(content).toContain("img2.tif");
    // Should NOT contain run 2 images
    expect(content).not.toContain("img3.tif");
  });

  it("generates Markdown", async () => {
    const outFile = join(OUTPUT_DIR, "report.md");
    await generateMarkdownReport(db, 1, { outputPath: outFile });
    expect(await Bun.file(outFile).exists()).toBe(true);
    const content = await Bun.file(outFile).text();
    expect(content).toContain("# Validation Report");
    expect(content).toContain("img2.tif");
    expect(content).toContain("Critical"); // Uppercase/lowercase? In DB it is 'critical'. Markdown report uppercases? No, uses string from DB.
    // The markdown report: `### Critical (${criticalFailures.length})`
    expect(content).toContain("Critical (1)");
  });

  it("generates Markdown with config", async () => {
    // Create a dummy config file
    await Bun.write("project-spec.yaml", "project:\n  name: Test Project");
    
    const outFile = join(OUTPUT_DIR, "report_config.md");
    await generateMarkdownReport(db, 1, { outputPath: outFile, includeConfig: true });
    
    const content = await Bun.file(outFile).text();
    expect(content).toContain("```yaml");
    expect(content).toContain("name: Test Project");
    expect(content).toContain("```");
  });

  it("generates HTML", async () => {
    const outFile = join(OUTPUT_DIR, "report.html");
    await generateHtmlReport(db, 1, { outputPath: outFile, dbPath: TEST_DB });
    expect(await Bun.file(outFile).exists()).toBe(true);
    const content = await Bun.file(outFile).text();
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain("img2.tif");
    expect(content).toContain("too small");
  });

});