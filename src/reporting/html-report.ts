import { Database } from "bun:sqlite";
import { HtmlReportOptions } from "../types/reporting";
import { join, dirname, basename } from "path";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

export async function generateHtmlReport(
  db: Database,
  runId: number,
  options: HtmlReportOptions
): Promise<string> {
  const { outputPath, title = "Validation Report", includeDatabase = true } = options;

  // 1. Prepare Output Directory
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // 2. Load Template
  const templatePath = join(process.cwd(), "src/reporting/templates/report.html");
  let html = await Bun.file(templatePath).text();

  // 3. Fetch Data
  const runStmt = db.prepare("SELECT * FROM validation_runs WHERE id = ?");
  const run = runStmt.get(runId) as any;
  if (!run) throw new Error(`Run ID ${runId} not found`);

  // Calculate stats
  const imageStatusStmt = db.prepare(`
    SELECT 
      i.filename,
      MAX(CASE WHEN v.status = 'fail' THEN 1 ELSE 0 END) as is_failed
    FROM validation_results v
    JOIN images i ON v.image_id = i.id
    WHERE v.validation_run = ?
    GROUP BY i.id
  `);
  const imageStatuses = imageStatusStmt.all(runId) as any[];
  const totalImages = imageStatuses.length;
  const failedCount = imageStatuses.filter(i => i.is_failed).length;
  const passedCount = totalImages - failedCount;
  const passRate = totalImages > 0 ? ((passedCount / totalImages) * 100).toFixed(1) : "0";

  // Get Failures
  const failedStmt = db.prepare(`
    SELECT i.filename, v.check_type, v.severity, v.message
    FROM validation_results v
    JOIN images i ON v.image_id = i.id
    WHERE v.validation_run = ? AND v.status = 'fail'
    ORDER BY v.severity DESC, i.filename ASC
  `);
  const failures = failedStmt.all(runId) as any[];

  // 4. Generate Tables
  let failedTable = `<table><thead><tr><th>Filename</th><th>Check</th><th>Severity</th><th>Message</th></tr></thead><tbody>`;
  if (failures.length === 0) {
    failedTable += `<tr><td colspan="4">No failures found.</td></tr>`;
  } else {
    for (const f of failures) {
      failedTable += `<tr>
        <td>${f.filename}</td>
        <td>${f.check_type}</td>
        <td><span class="status-badge severity-${f.severity}">${f.severity}</span></td>
        <td>${f.message}</td>
      </tr>`;
    }
  }
  failedTable += `</tbody></table>`;

  let passedList = `<ul>`;
  // Limit passed list to avoid huge HTML
  if (passedCount > 1000) {
      passedList += `<li>${passedCount} images passed (list truncated)</li>`;
  } else {
      // We need to fetch passed filenames
      // This is a bit expensive if we only have failed ones.
      // Optimization: We already have imageStatuses
      const passedFiles = imageStatuses.filter(i => !i.is_failed).map(i => i.filename);
      for (const p of passedFiles) {
          passedList += `<li>${p}</li>`;
      }
  }
  passedList += `</ul>`;

  // Config
  let configYaml = "Config not available in DB";
  try {
      if (await Bun.file("project-spec.yaml").exists()) {
          configYaml = await Bun.file("project-spec.yaml").text();
      }
  } catch (e) {}

  // 5. Inject Data
  html = html.replace(/{{project_name}}/g, title);
  html = html.replace(/{{run_id}}/g, String(runId));
  html = html.replace(/{{version}}/g, String(run.version));
  html = html.replace(/{{date}}/g, run.started_at);
  html = html.replace(/{{total_images}}/g, String(totalImages));
  html = html.replace(/{{passed_count}}/g, String(passedCount));
  html = html.replace(/{{failed_count}}/g, String(failedCount));
  html = html.replace(/{{pass_rate}}/g, passRate);
  html = html.replace(/{{failed_table}}/g, failedTable);
  html = html.replace(/{{passed_list}}/g, passedList);
  html = html.replace(/{{config_yaml}}/g, configYaml);

  // 6. Handle Database Embedding & Assets
  if (includeDatabase) {
    html = html.replace(/{{show_query_class}}/g, "");
    
    // Copy Assets
    const assetsDest = join(outputDir, "assets");
    if (!existsSync(assetsDest)) {
        await mkdir(assetsDest, { recursive: true });
    }

    const assetsSrc = join(process.cwd(), "assets");
    if (existsSync(join(assetsSrc, "sql-wasm.js"))) {
        await copyFile(join(assetsSrc, "sql-wasm.js"), join(assetsDest, "sql-wasm.js"));
    }
    if (existsSync(join(assetsSrc, "sql-wasm.wasm"))) {
        await copyFile(join(assetsSrc, "sql-wasm.wasm"), join(assetsDest, "sql-wasm.wasm"));
    }

    // Embed DB
    try {
        const dbPath = options.dbPath || "validation.db";
        if (await Bun.file(dbPath).exists()) {
            const dbBuffer = await Bun.file(dbPath).arrayBuffer();
            const dbBase64 = Buffer.from(dbBuffer).toString('base64');
            html = html.replace(/{{database_base64}}/g, dbBase64);
        } else {
            console.warn("validation.db not found for embedding");
            html = html.replace(/{{database_base64}}/g, "");
        }
    } catch (e) {
        console.error("Error embedding DB:", e);
        html = html.replace(/{{database_base64}}/g, "");
    }

  } else {
    html = html.replace(/{{show_query_class}}/g, "hidden");
    html = html.replace(/{{database_base64}}/g, "");
  }

  await Bun.write(outputPath, html);
  return outputPath;
}
