import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createFakeJhove,
  prependPath,
  clearFakeJhoveEnv,
  setFakeJhoveEnv
} from "../helpers/fake-jhove";
import {
  validateTiff,
  validateTiffBatch,
  getJhoveVersion,
  isJhoveInstalled
} from "../../src/validation/jhove";

let cleanup: (() => void) | null = null;
let restorePath: (() => void) | null = null;
let binPath: string = "";

beforeEach(() => {
  const fake = createFakeJhove();
  cleanup = fake.cleanup;
  binPath = `${fake.binDir}/jhove`;
  restorePath = prependPath(fake.binDir);
  clearFakeJhoveEnv();
});

afterEach(() => {
  restorePath?.();
  cleanup?.();
  clearFakeJhoveEnv();
});

describe("JHOVE wrapper", () => {
  it("should detect installation and return version", async () => {
    setFakeJhoveEnv({ jhoveVersion: "1.30.0" });

    // We can use the default PATH lookup or explicit path
    const installed = await isJhoveInstalled();
    const version = await getJhoveVersion();

    expect(installed).toBe(true);
    expect(version).toBe("1.30.0");
  });

  it("should validate a valid TIFF", async () => {
    setFakeJhoveEnv({ status: "Well-Formed and valid" });

    const result = await validateTiff("test.tif");

    expect(result.valid).toBe(true);
    expect(result.status).toBe("valid");
    expect(result.filepath).toBe("test.tif");
    expect(result.errors.length).toBe(0);
  });

  it("should report invalid TIFF", async () => {
    setFakeJhoveEnv({ 
      status: "Not well-formed",
      error: "Unexpected end of file"
    });

    const result = await validateTiff("bad.tif");

    expect(result.valid).toBe(false);
    expect(result.status).toBe("not-well-formed");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBe("Unexpected end of file");
  });

  it("should treat status capitalization variants as not well-formed", async () => {
    setFakeJhoveEnv({ status: "NOT WELL-FORMED" });

    const result = await validateTiff("caps-bad.tif");

    expect(result.valid).toBe(false);
    expect(result.status).toBe("not-well-formed");
  });

  it("should validate batch", async () => {
    setFakeJhoveEnv({ status: "Well-Formed and valid" });

    const files = ["file1.tif", "file2.tif"];
    const results = await validateTiffBatch(files);

    expect(results.size).toBe(2);
    expect(results.get("file1.tif")?.valid).toBe(true);
    expect(results.get("file2.tif")?.valid).toBe(true);
  });

  it("should use custom path if provided", async () => {
    setFakeJhoveEnv({ jhoveVersion: "9.9.9" });
    const version = await getJhoveVersion(binPath);
    expect(version).toBe("9.9.9");
  });
});
