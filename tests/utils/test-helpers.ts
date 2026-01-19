import { Database } from "bun:sqlite";
import { initDatabase, closeDatabase } from "../../src/utils/db-schema";
import { join } from "path";
import { mkdir, rm, writeFile, cp } from "node:fs/promises";
import { existsSync } from "fs";

export const TEST_PROJECT_ROOT = "test_project_root";

export async function createTempProject(name: string): Promise<string> {
  const dir = join(TEST_PROJECT_ROOT, name);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, "images"));
  await mkdir(join(dir, "reports"));
  await mkdir(join(dir, "outputs"));
  return dir;
}

export async function cleanupTempProjects() {
  if (existsSync(TEST_PROJECT_ROOT)) {
    await rm(TEST_PROJECT_ROOT, { recursive: true, force: true });
  }
}

export async function createDummyImage(dir: string, filename: string, type: 'TIFF' | 'RAW' = 'TIFF') {
  // Just create an empty file for now, or copy a fixture if we had real ones.
  // For integration tests that run actual tools, we might need real files.
  // But for logic testing, dummy files might suffice if we mock the extraction layer.
  // However, "Integration" usually means running with real tools.
  // We need real TIFF/RAW files for ExifTool/JHOVE.
  // Creating 0-byte files might fail ExifTool.
  // We can write a minimal valid TIFF header?
  // Or just use text files and expect failures, validating that the system handles "corrupt" files correctly.
  
  await writeFile(join(dir, "images", filename), "dummy content");
}

export async function writeConfig(dir: string, config: any) {
  const yaml = require('yaml');
  await writeFile(join(dir, "project-spec.yaml"), yaml.stringify(config));
}
