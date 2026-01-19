import { describe, it, expect } from "bun:test";
import { validateFilename } from "../../src/validation/filename-validator";
import { ProjectSpec } from "../../src/types/config";

describe("Filename Validator", () => {
  const spec: ProjectSpec['naming'] = {
    pattern: "^IMG_\\d{4}\\.tif$",
    allow_spaces: false,
    required_prefix: "IMG_"
  };

  it("passes valid filename", () => {
    const result = validateFilename("/path/to/IMG_0001.tif", spec);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("fails pattern mismatch", () => {
    const result = validateFilename("ABC_0001.tif", spec);
    expect(result.passed).toBe(false);
    expect(result.failures.find(f => f.rule === 'pattern')).toBeDefined();
  });

  it("fails spaces if disallowed", () => {
    const result = validateFilename("IMG 0001.tif", spec);
    expect(result.passed).toBe(false);
    expect(result.failures.find(f => f.rule === 'spaces')).toBeDefined();
  });

  it("fails prefix mismatch", () => {
    const result = validateFilename("DSC_0001.tif", spec);
    expect(result.passed).toBe(false);
    expect(result.failures.find(f => f.rule === 'prefix')).toBeDefined();
  });

  it("fails uppercase extension", () => {
    const result = validateFilename("IMG_0001.TIF", spec);
    expect(result.passed).toBe(false); // Or true depending on strictness? Code says 'warning' severity usually means passed=false in strict logic?
    // Wait, validateFilename returns passed=false if ANY failure.
    // In spec-validator, warnings might be ignored for pass/fail status, but here we just report validity against rules.
    // The implementation: passed: failures.length === 0.
    expect(result.passed).toBe(false);
    expect(result.failures.find(f => f.rule === 'extension_case')).toBeDefined();
  });
});
