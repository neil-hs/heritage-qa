import { expect, test, describe } from "bun:test";
import { parseConfigString } from "../../src/config/parse-config";

describe("Config Parser", () => {
  test("should parse a valid YAML config", () => {
    const validYaml = `
project:
  name: "Test Project"
format:
  file_type: "TIFF"
  allowed_extensions: [".tif", ".tiff"]
validation:
  run_jhove: true
`;
    const result = parseConfigString(validYaml);
    expect(result.success).toBe(true);
    expect(result.config?.project.name).toBe("Test Project");
    expect(result.config?.format.file_type).toBe("TIFF");
    expect(result.config?.validation.run_jhove).toBe(true);
  });

  test("should strip $schema reference", () => {
    const yamlWithSchema = `
$schema: ./schemas/config-schema.json
project:
  name: "Schema Project"
format:
  file_type: "RAW"
  allowed_extensions: [".dng"]
validation:
  run_jhove: false
`;
    const result = parseConfigString(yamlWithSchema);
    expect(result.success).toBe(true);
    expect(result.config?.project.name).toBe("Schema Project");
    // @ts-ignore
    expect(result.config?.$schema).toBeUndefined();
  });

  test("should handle malformed YAML", () => {
    const malformedYaml = `
project:
  name: "Test Project"
  invalid line: : :
`;
    const result = parseConfigString(malformedYaml);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBeDefined();
  });

  test("should handle empty file", () => {
    const result = parseConfigString("");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toBe("Configuration file is empty");
  });

  test("should handle non-object root", () => {
    const result = parseConfigString("just a string");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toBe("Configuration must be a YAML object");
  });

  test("should handle file not found", async () => {
    // We import parseConfig dynamically or from the module if we exported it
    // But unit tests usually import the SUT. Let's check imports.
    const { parseConfig } = await import("../../src/config/parse-config");
    const result = await parseConfig("non-existent-file.yaml");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("Configuration file not found");
  });
});
