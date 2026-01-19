import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { initDatabase, closeDatabase, resetDatabase, Database } from "../../src/utils/db-schema";
import { insertImage, getImageByPath, insertExifData } from "../../src/utils/query-helpers";

const TEST_DB = "test.db";

describe("Database", () => {
  let db: Database;

  beforeEach(() => {
    resetDatabase(TEST_DB);
  });

  afterEach(() => {
    if (db) {
        try {
            closeDatabase(db);
        } catch (e) {
            // ignore if already closed
        }
    }
    resetDatabase(TEST_DB);
  });

  it("should create tables", () => {
    db = initDatabase(TEST_DB);
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);
    expect(tableNames).toContain("images");
    expect(tableNames).toContain("exif_data");
    expect(tableNames).toContain("validation_results");
  });

  it("should insert and retrieve image", () => {
    db = initDatabase(TEST_DB);
    const imgId = insertImage(db, {
        filepath: "/path/to/img.tif",
        filename: "img.tif",
        extension: ".tif",
        file_type: "TIFF",
        file_size: 1024
    });

    const retrieved = getImageByPath(db, "/path/to/img.tif");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(imgId);
    expect(retrieved?.fileType).toBe("TIFF");
  });
  
  it("should insert exif data", () => {
    db = initDatabase(TEST_DB);
    const imgId = insertImage(db, {
        filepath: "/path/to/img2.tif",
        filename: "img2.tif",
        extension: ".tif",
        file_type: "TIFF",
        file_size: 2048
    });
    
    insertExifData(db, imgId, { "Make": "Canon", "Model": "EOS" });
    
    const rows = db.query("SELECT * FROM exif_data WHERE image_id = $id").all({ $id: imgId }) as any[];
    expect(rows.length).toBe(2);
    expect(rows.find(r => r.tag_name === "Make").tag_value).toBe("Canon");
  });
});
