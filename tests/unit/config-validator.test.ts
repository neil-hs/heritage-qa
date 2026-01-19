import { expect, test, describe } from "bun:test";
import { validateConfig } from "../../src/config/validate-config";

describe("Config Validator", () => {
  test("should validate a valid config", async () => {
    const validConfig = {
      project: { name: "Test Project" },
      format: {
        file_type: "TIFF",
        allowed_extensions: [".tif", ".tiff"]
      },
      validation: { run_jhove: true }
    };
    const result = await validateConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test("should catch missing required fields", async () => {
    const invalidConfig = {
      project: { name: "Test Project" }
      // missing format and validation
    };
    const result = await validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("must have required property 'format'"))).toBe(true);
  });

  test("should catch invalid enum values", async () => {
    const invalidConfig = {
      project: { name: "Test Project" },
      format: {
        file_type: "INVALID",
        allowed_extensions: [".tif"]
      },
      validation: { run_jhove: true }
    };
    const result = await validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes("file_type"))).toBe(true);
  });

  test("should warn about RAW + JHOVE", async () => {
    const config = {
      project: { name: "RAW Project" },
      format: {
        file_type: "RAW",
        allowed_extensions: [".dng"],
        raw_format: "DNG"
      },
      validation: { run_jhove: true }
    };
    const result = await validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes("JHOVE doesn't support RAW"))).toBe(true);
  });

  test("should catch min > max dimensions", async () => {
    const config = {
      project: { name: "Dim Project" },
      format: {
        file_type: "TIFF",
        allowed_extensions: [".tif"]
      },
      dimensions: {
        min_long_edge: 5000,
        max_long_edge: 4000
      },
      validation: { run_jhove: true }
    };
    const result = await validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("cannot be greater than maximum"))).toBe(true);
  });

  test("should warn about unknown EXIF tags with suggestions", async () => {
    const config = {
      project: { name: "EXIF Project" },
      format: {
        file_type: "TIFF",
        allowed_extensions: [".tif"]
      },
      required_exif: [
        { tag: "Modl" } // Typos of "Model"
      ],
      validation: { run_jhove: true }
    };
    const result = await validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.suggestion && w.suggestion.includes("Model"))).toBe(true);
  });

  test("should validate date format", async () => {
    const invalidDateConfig = {
      project: { 
        name: "Date Test",
        date: "2025/01/19" // Invalid format, should be YYYY-MM-DD
      },
      format: {
        file_type: "TIFF",
        allowed_extensions: [".tif"]
      },
      validation: { run_jhove: true }
    };
    const result = await validateConfig(invalidDateConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('must match format "date"'))).toBe(true);

    const validDateConfig = { ...invalidDateConfig };
    validDateConfig.project = { ...invalidDateConfig.project, date: "2025-01-19" };
    const validResult = await validateConfig(validDateConfig);
    expect(validResult.valid).toBe(true);
  });

  test("should require raw_format when file_type is RAW", async () => {
    const invalidRawConfig = {
      project: { name: "RAW Test" },
      format: {
        file_type: "RAW",
        allowed_extensions: [".dng"]
        // Missing raw_format
      },
      validation: { run_jhove: false }
    };
    const result = await validateConfig(invalidRawConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("must have required property 'raw_format'"))).toBe(true);

    const validRawConfig = { ...invalidRawConfig };
    validRawConfig.format = { ...invalidRawConfig.format, raw_format: "DNG" };
    const validResult = await validateConfig(validRawConfig);
    expect(validResult.valid).toBe(true);
  });
});
