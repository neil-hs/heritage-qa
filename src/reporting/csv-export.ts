import { Database } from "bun:sqlite";
import { CsvOptions } from "../types/reporting";
import { ValidationStatus } from "../types/config";

export async function exportToCsv(
  db: Database,
  runId: number,
  options: CsvOptions
): Promise<string> {
  const { outputPath, type, delimiter = ',', includeHeader = true } = options;

  let query = "";
  let headers: string[] = [];
  
  if (type === 'failed') {
    headers = ["filepath", "filename", "check_type", "severity", "status", "message"];
    query = `
      SELECT 
        i.filepath, 
        i.filename, 
        v.check_type, 
        v.severity, 
        v.status, 
        v.message 
      FROM validation_results v
      JOIN images i ON v.image_id = i.id
      WHERE v.validation_run = ? 
      AND v.status = 'fail'
    `;
  } else if (type === 'all') {
    headers = ["filepath", "filename", "file_type", "file_size", "status", "dimension_status", "color_status", "exif_status", "jhove_status"];
    
    // Filter images that participated in this run
    query = `
      SELECT DISTINCT i.* 
      FROM images i
      JOIN validation_results v ON i.id = v.image_id
      WHERE v.validation_run = ?
    `;
  } else if (type === 'summary') {
    headers = ["check_type", "total", "passed", "failed", "pass_rate"];
    query = `
      SELECT 
        check_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as failed
      FROM validation_results
      WHERE validation_run = ?
      GROUP BY check_type
    `;
  }

  let content = "";
  if (includeHeader) {
    content += headers.join(delimiter) + "\n";
  }

  if (type === 'failed' || type === 'summary') {
    const stmt = db.prepare(query);
    const rows = stmt.all(runId) as any[];

    for (const row of rows) {
      const line = headers.map(h => {
        let val = row[h];
        if (type === 'summary' && h === 'pass_rate') {
          const total = row['total'];
          const passed = row['passed'];
          val = total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '0%';
        }
        return escapeCsv(String(val ?? ''), delimiter);
      });
      content += line.join(delimiter) + "\n";
    }
  } else if (type === 'all') {
    // For 'all', we need to fetch images and their results
    const imagesStmt = db.prepare(query);
    const images = imagesStmt.all(runId) as any[];
    
    // Fetch all results for this run
    const resultsStmt = db.prepare("SELECT image_id, check_type, status FROM validation_results WHERE validation_run = ?");
    const results = resultsStmt.all(runId) as any[];
    
    // Map results by image_id
    const resultsMap = new Map<number, Record<string, string>>();
    for (const r of results) {
      if (!resultsMap.has(r.image_id)) {
        resultsMap.set(r.image_id, {});
      }
      resultsMap.get(r.image_id)![r.check_type] = r.status;
    }

    for (const img of images) {
      const imgResults = resultsMap.get(img.id) || {};
      
      // Determine overall status
      const statuses = Object.values(imgResults);
      const overallStatus = statuses.includes('fail') ? 'fail' : 'pass'; // Simple logic

      const line = [
        img.filepath,
        img.filename,
        img.file_type,
        img.file_size,
        overallStatus,
        imgResults['dimension'] || 'n/a',
        imgResults['color'] || 'n/a',
        imgResults['exif'] || 'n/a', // check_type in DB is 'exif' not 'exif_tag' based on PRD vs DB schema match? DB says 'exif'
        imgResults['jhove'] || 'n/a'
      ].map(val => escapeCsv(String(val ?? ''), delimiter));
      
      content += line.join(delimiter) + "\n";
    }
  }

  await Bun.write(outputPath, content);
  return outputPath;
}

function escapeCsv(val: string, delimiter: string): string {
  if (val.includes(delimiter) || val.includes('"') || val.includes('\n')) {
    // Escape double quotes by doubling them
    const escaped = val.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return val;
}
