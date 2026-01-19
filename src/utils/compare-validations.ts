import { Database } from "bun:sqlite";
import { ValidationStatus } from "../types/config";

export interface ImageComparison {
  filepath: string;
  filename: string;
  statusA: ValidationStatus | 'missing';
  statusB: ValidationStatus | 'missing';
  failuresA: string[];
  failuresB: string[];
}

export interface ComparisonResult {
  runA: { id: number; version: number };
  runB: { id: number; version: number };
  summary: {
    fixed: number;
    newFailures: number;
    stillFailing: number;
    unchanged: number;
    netChange: number;
  };
  fixed: ImageComparison[];
  newFailures: ImageComparison[];
  stillFailing: ImageComparison[];
  unchanged: ImageComparison[];
}

interface RunImageStatus {
  status: ValidationStatus;
  failures: string[];
}

function getRunStatus(db: Database, runId: number): Map<number, RunImageStatus> {
  const map = new Map<number, RunImageStatus>();
  
  // Get all results
  const rows = db.prepare(`
    SELECT image_id, status, message 
    FROM validation_results 
    WHERE validation_run = ?
  `).all(runId) as { image_id: number; status: ValidationStatus; message: string }[];

  for (const row of rows) {
    if (!map.has(row.image_id)) {
      map.set(row.image_id, { status: 'pass', failures: [] });
    }
    const entry = map.get(row.image_id)!;
    
    // Update status priority: fail > warning > pass
    if (row.status === 'fail') {
      entry.status = 'fail';
    } else if (row.status === 'warning' && entry.status !== 'fail') {
      entry.status = 'warning';
    }
    
    if (row.status === 'fail' || row.status === 'warning') {
      if (row.message) entry.failures.push(row.message);
    }
  }
  
  return map;
}

export async function compareRuns(
  db: Database,
  runIdA: number,
  runIdB: number
): Promise<ComparisonResult> {
  // Get run details
  const runA = db.prepare("SELECT id, version FROM validation_runs WHERE id = ?").get(runIdA) as { id: number; version: number };
  const runB = db.prepare("SELECT id, version FROM validation_runs WHERE id = ?").get(runIdB) as { id: number; version: number };
  
  if (!runA || !runB) throw new Error("Run not found");

  const statusMapA = getRunStatus(db, runIdA);
  const statusMapB = getRunStatus(db, runIdB);
  
  // Get all image IDs involved in either run
  const allImageIds = new Set([...statusMapA.keys(), ...statusMapB.keys()]);
  
  // Need file info for reporting
  const imageInfoStmt = db.prepare("SELECT id, filepath, filename FROM images WHERE id = ?");
  
  const result: ComparisonResult = {
    runA,
    runB,
    summary: { fixed: 0, newFailures: 0, stillFailing: 0, unchanged: 0, netChange: 0 },
    fixed: [],
    newFailures: [],
    stillFailing: [],
    unchanged: []
  };

  for (const imageId of allImageIds) {
    const info = imageInfoStmt.get(imageId) as { filepath: string; filename: string };
    if (!info) continue; // Should not happen

    const resA = statusMapA.get(imageId) || { status: 'missing', failures: [] };
    const resB = statusMapB.get(imageId) || { status: 'missing', failures: [] };
    
    // Normalize missing to null/undefined equivalent or handle explicitly
    // PRD assumes "statusA" and "statusB". 'missing' handles deleted/added files.
    // Logic:
    // fail -> pass : fixed
    // pass -> fail : newFailure
    // fail -> fail : stillFailing
    // else : unchanged (pass->pass, missing->pass, pass->missing, etc.?)
    
    // Let's stick to strict PRD logic where relevant:
    
    const comp: ImageComparison = {
      filepath: info.filepath,
      filename: info.filename,
      statusA: resA.status as ValidationStatus | 'missing',
      statusB: resB.status as ValidationStatus | 'missing',
      failuresA: resA.failures,
      failuresB: resB.failures
    };
    
    const isFailA = resA.status === 'fail';
    const isPassA = resA.status === 'pass' || resA.status === 'warning' || resA.status === 'skip'; // Warning is pass-ish? PRD says "pass".
    // PRD: "fail -> pass : fixed". If warning is considered pass for fixing critical bugs.
    // If strict: fail -> warning is Improvement?
    // Let's assume fail is fail, everything else is non-fail.
    
    const isFailB = resB.status === 'fail';
    
    if (isFailA && !isFailB && resB.status !== 'missing') {
      result.fixed.push(comp);
      result.summary.fixed++;
    } else if (!isFailA && isFailB && resA.status !== 'missing') {
      result.newFailures.push(comp);
      result.summary.newFailures++;
    } else if (isFailA && isFailB) {
      result.stillFailing.push(comp);
      result.summary.stillFailing++;
    } else {
      result.unchanged.push(comp);
      result.summary.unchanged++;
    }
  }

  result.summary.netChange = result.summary.fixed - result.summary.newFailures;

  return result;
}
