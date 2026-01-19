# Heritage QC - Image Validation Skill

## Description
Validate heritage digitization images against client specifications. This skill helps you orchestrate the quality control process for digitization projects, ensuring images meet strict archival standards.

## Capabilities
- **Parse client requirements**: Convert natural language specs (PDF/Word) into structured configuration files.
- **Extract Metadata**: Pull comprehensive EXIF/IPTC/XMP data from TIFF and RAW files.
- **Validate Specifications**: Check dimensions, bit depth, color space, and required metadata tags.
- **Format Validation**: Verify structural integrity of TIFF files using JHOVE.
- **Reporting**: Generate interactive HTML dashboards, detailed CSVs, and Markdown summaries.
- **Fix Generation**: Create shell scripts to automatically fix common metadata issues.

## Prerequisites
- **Bun**: Runtime environment (`curl -fsSL https://bun.sh/install | bash`)
- **ExifTool**: Required for metadata extraction (`brew install exiftool` or `apt install libimage-exiftool-perl`)
- **JHOVE**: Recommended for deep TIFF validation (install from [openpreservation.org](https://jhove.openpreservation.org/))

## Quick Start

1. **Locate Images**: Identify the directory containing your project images.
2. **Setup Project**: Use the `heritage-qc` templates to create a `project-spec.yaml`.
3. **Run Validation**: Orchestrate the validation workflow (Extract -> Validate -> Report).
4. **Review**: Check the HTML report for failures.
5. **Fix**: Use generated scripts to correct metadata issues.
6. **Verify**: Re-run validation to ensure clean deliverables.

## Workflows

### 1. New Project Setup

**User:** "I have a new project with TIFF files in `/Volumes/Archive/ProjectA/`."

**Claude:**
1. Create a project directory (e.g., `~/projects/ProjectA-QC`).
2. Copy a template config (`templates/museum-spec.yaml`) to `project-spec.yaml`.
3. Ask user for specific requirements (min dimensions, required tags).
4. Update `project-spec.yaml` with user requirements.

### 2. Validate Images

**Claude Orchestration:**

1. **Scan Directory**:
   - Check file types in the target directory.
   - Warn if mismatched types found (e.g., JPEGs in a TIFF folder).

2. **Extract EXIF**:
   - Run extraction batch process.
   - Populate SQLite database.

3. **Run Validation**:
   - Execute `spec-validator` against the database.
   - Run JHOVE (if enabled/available).

4. **Generate Reports**:
   - Create HTML, Markdown, and CSV reports in `reports/` folder.

**Command Sequence:**
```bash
# 1. Config Check
bun run src/config/validate-config.ts project-spec.yaml

# 2. (Internal) Validation Orchestration logic runs here
# - Calls extract-exif
# - Calls validate-specs
# - Calls run-jhove
```

### 3. Fix Issues

If validation finds "fixable" issues (e.g., missing Artist tag):

1. **Generate Script**:
   ```bash
   # (Internal) Calls generate-fix-script
   ```
2. **Review**: Show user the generated script (`outputs/fix_exif_v1.sh`).
3. **Execute**: User runs the script (or Claude runs if authorized).
   ```bash
   chmod +x outputs/fix_exif_v1.sh
   ./outputs/fix_exif_v1.sh
   ```
4. **Re-Validate**: Run validation again to confirm fixes.

### 4. Multi-Directory Projects

For projects with RAW originals and TIFF masters:

1. **RAW First**:
   - Create `raw-spec.yaml`.
   - Validate RAW directory.
   - Ensure `run_jhove: false`.

2. **TIFF Second**:
   - Create `deliverable-spec.yaml`.
   - Validate TIFF directory.
   - Ensure `run_jhove: true`.

## Commands

### Validate Config
Check if your `project-spec.yaml` is valid.
```bash
bun run src/config/validate-config.ts project-spec.yaml
```

### Full Validation (Orchestrated)
*Note: This is typically managed by the AI agent logic, calling internal functions.*

### Generate Reports
Manually regenerate reports from an existing database run.
```bash
# (Internal function usage)
# generateHtmlReport(db, runId, options)
```

## Error Handling

- **ExifTool missing**: Ensure it's in your PATH.
- **Database lock**: Ensure no other process is accessing `validation.db`.
- **Permission denied**: Check read/write permissions on image directory and output directory.

## Examples

**User**: "Validate the images in `/data/images` using the museum template."

**Claude**:
1. Checks `/data/images`.
2. Creates `project-spec.yaml` from `templates/museum-spec.yaml`.
3. Runs validation.
4. Generates `reports/validation_report_v1.html`.
5. Summarizes: "Processed 50 images. 48 passed, 2 failed (missing copyright tag)."

---
*Generated for Heritage QC Skill*
