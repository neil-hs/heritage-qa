import { Database } from "bun:sqlite";
import { readFileSync, unlinkSync, existsSync } from "fs";

export { Database } from "bun:sqlite";

export function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  
  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON;");
  
  // Initialize schema if tables don't exist
  const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='images';").get();
  
  if (!tableExists) {
    const schemaPath = "schemas/database.sql";
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, "utf-8");
      // Split by semicolon to execute multiple statements
      const statements = schema.split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
      
      for (const stmt of statements) {
          db.run(stmt);
      }
    } else {
        throw new Error(`Schema file not found at ${schemaPath}`);
    }
  }
  
  return db;
}

export function closeDatabase(db: Database): void {
  db.close();
}

export function resetDatabase(dbPath: string): void {
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
}
