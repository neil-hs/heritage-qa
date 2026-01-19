import { chmod } from "node:fs/promises";
import { Database } from "bun:sqlite";
import { FixScriptOptions, FixableIssue } from "../types/fixes";
import { quote } from "shell-quote";
import { ExifTagCheckResult, TagFailure } from "../validation/exif-tag-validator";

// Helper to escape for shell
function escapeShell(arg: string): string {
  // shell-quote handles it best
  return quote([arg]);
}

export async function getFixableIssues(
  db: Database,
  runId: number
): Promise<FixableIssue[]> {
  const issues: FixableIssue[] = [];

  // Query fixable results
  const stmt = db.prepare(`
    SELECT i.filepath, v.check_type, v.details
    FROM validation_results v
    JOIN images i ON v.image_id = i.id
    WHERE v.validation_run = ? AND v.severity = 'fixable'
  `);

  const rows = stmt.all(runId) as { filepath: string; check_type: string; details: string }[];

  for (const row of rows) {
    if (row.check_type === 'exif') {
      try {
        const result = JSON.parse(row.details) as ExifTagCheckResult;
        if (result.failures) {
          for (const failure of result.failures) {
            if (failure.severity === 'fixable') {
              // We only fix missing or wrong_value tags if we know the expected value
              if (failure.expected) {
                issues.push({
                  filepath: row.filepath,
                  fixType: 'exif_tag',
                  tag: failure.tag,
                  currentValue: failure.actual,
                  targetValue: failure.expected
                });
              } else if (failure.reason === 'missing' && failure.expected) {
                 // Already handled by failure.expected check above
              }
            }
          }
        }
      } catch (e) {
        console.error(`Failed to parse details for ${row.filepath}:`, e);
      }
    }
    // Future: handle other fix types like color space
  }

  return issues;
}

export async function generateFixScript(
  db: Database,
  runId: number,
  options: FixScriptOptions
): Promise<string> {
  const { outputPath, dryRun = false, backup = false, batchSize } = options;
  const issues = await getFixableIssues(db, runId);

  if (issues.length === 0) {
    const script = `#!/bin/bash\n# No fixable issues found for run ${runId}\necho "No fixable issues found."
`;
    await Bun.write(outputPath, script);
    return script; // Or return empty string? PRD says generate script.
  }

  // Group by file to combine commands
  const fixesByFile = new Map<string, FixableIssue[]>();
  for (const issue of issues) {
    if (!fixesByFile.has(issue.filepath)) {
      fixesByFile.set(issue.filepath, []);
    }
    fixesByFile.get(issue.filepath)!.push(issue);
  }

  const lines: string[] = [];
  lines.push(`#!/bin/bash`);
  lines.push(`# Heritage QC Fix Script`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Run: ${runId}`);
  lines.push(`# Fixes: ${issues.length} issues in ${fixesByFile.size} files`);
  lines.push(``);
  lines.push(`set -e`);
  lines.push(``);
  lines.push(`echo "Fixing ${fixesByFile.size} files..."`);
  lines.push(``);

  if (backup) {
    lines.push(`# Create backup directory`);
    lines.push(`mkdir -p backups`);
    lines.push(``);
  }

  for (const [filepath, fileIssues] of fixesByFile) {
    const exifArgs: string[] = [];
    
    // Backup command
    if (backup) {
      const backupFile = `backups/${filepath.split('/').pop()}`; // Simple filename backup
      // Better backup path handling needed? 
      // For now, flat backup structure might collide if same filename in different dirs.
      // Let's rely on full path structure or just assume simple case. 
      // safer: cp "path/to/file.tif" "backups/path_to_file.tif"
      const safeBackupName = filepath.replace(/\//g, '_').replace(/^_+/, '');
      lines.push(`cp ${escapeShell(filepath)} ${escapeShell("backups/" + safeBackupName)}`);
    }

    for (const issue of fileIssues) {
      if (issue.fixType === 'exif_tag' && issue.tag && issue.targetValue) {
        // ExifTool syntax: -Tag="Value"
        // Need to quote value carefully.
        // shell-quote escapes the whole argument.
        // So we construct `-Tag=Value` then escape it? No.
        // ExifTool expects argument like `-Tag=Value`.
        // If Value has spaces: `-Tag=Value with spaces`
        // Shell sees: `exiftool "-Tag=Value with spaces"`
        
        // Wait, shell-quote `quote(['-Tag=Value'])` -> `'-Tag=Value'`
        // If value has quotes: `Val'ue` -> `'-Tag=Val'\''ue'`
        
        // Construct the argument string unescaped
        const arg = `-${issue.tag}=${issue.targetValue}`;
        exifArgs.push(escapeShell(arg));
      }
    }

    if (exifArgs.length > 0) {
      let cmd = `exiftool -overwrite_original`;
      if (dryRun) {
        // For dry run, we don't want to actually run it. 
        // We can echo the command.
        // But `echo exiftool ...` might be confusing if quotes are stripped.
        // We probably want to output: echo "Running: exiftool ..."
        // Or just print the command to stdout without executing, which is what the script file IS.
        // Wait, "Dry-run mode (echo only)" usually means the SCRIPT echos commands instead of running them.
        cmd = `echo exiftool -overwrite_original`; 
      }
      
      cmd += ` ${exifArgs.join(' ')} ${escapeShell(filepath)}`;
      lines.push(`# Fixing ${fileIssues.length} issues in ${filepath}`);
      lines.push(cmd);
      lines.push(``);
    }
  }

  lines.push(`echo "Done! Fixed ${fixesByFile.size} files."`);
  lines.push(`echo "Re-run validation to verify fixes."`);

  const content = lines.join('\n');
  await Bun.write(outputPath, content);
  
  try {
    await chmod(outputPath, 0o755);
  } catch (e) {
    console.warn(`Failed to chmod ${outputPath}:`, e);
  }
  
  return content;
}
