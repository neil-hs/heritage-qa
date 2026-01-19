import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTempProject, cleanupTempProjects, writeConfig, createDummyImage } from "../utils/test-helpers";
import { initDatabase } from "../../src/utils/db-schema";
import { validateConfigFile } from "../../src/config/validate-config";
import { join } from "path";

// We can't easily run full end-to-end without real images and tools installed in the CI env.
// So we will test the orchestration logic flow with mocks where possible, or just basic setup verification.

describe("Integration: Project Setup", () => {
  // We don't cleanup before to inspect if needed, but in test we should.
  // Actually, createTempProject cleans up specific dir.
  
  it("sets up a valid project structure", async () => {
    const projectDir = await createTempProject("setup_test");
    
    // Create a config
    // We need to match the schema exactly.
    // Required: project, format, validation.
    // color is NOT required? Let's check schema.
    const config = {
      project: { name: "Integration Test" },
      format: { file_type: "TIFF", allowed_extensions: [".tif"] },
      validation: { run_jhove: false },
      // Minimal required fields based on schema?
      color: { bit_depth: 16 } // color might be required if we use template-like structure, but schema says: required: ["project", "format", "validation"]
      // Actually schema says: "required": ["project", "format", "validation"]
      // But let's add color just in case schema was updated.
    };
    await writeConfig(projectDir, config);

    // Validate config
    // The test failure "Configuration file not found" suggests `validateConfig` might not be resolving path correctly
    // or the file wasn't written.
    // `writeConfig` uses `writeFile` from `node:fs/promises`.
    // Let's verify file existence.
    const configPath = join(projectDir, "project-spec.yaml");
    
    const result = await validateConfigFile(configPath);
    // If invalid, log errors
    if (!result.valid) {
        console.error("Config errors:", JSON.stringify(result.errors, null, 2));
    }
    expect(result.valid).toBe(true);

    // Init DB
    const dbPath = join(projectDir, "validation.db");
    const db = initDatabase(dbPath);
    expect(db).toBeDefined();
    
    // Check tables
    const table = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='images'").get();
    expect(table).toBeDefined();
    
    db.close();
  });
  
  afterAll(async () => {
    await cleanupTempProjects();
  });
});