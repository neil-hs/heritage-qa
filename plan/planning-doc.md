# Image Validation Skill - Implementation Planning Document

**Version:** 1.0  
**Date:** 2025-01-19  
**Purpose:** Guide AI code agents in implementing individual components  
**Target:** Heritage digitization image validation workflow

---

## Table of Contents

1. [Skill Information](#skill-information)
2. [Project Overview](#project-overview)
3. [System Architecture](#system-architecture)
4. [Implementation Phases](#implementation-phases)
5. [Component Breakdown](#component-breakdown)
6. [Data Models](#data-models)
7. [Configuration Schema Validation](#configuration-schema-validation)
8. [Multi-Directory Validation Strategy](#multi-directory-validation-strategy)
9. [Interface Specifications](#interface-specifications)
10. [Testing Strategy](#testing-strategy)
11. [Dependencies](#dependencies)
12. [Distribution & Installation](#distribution--installation)
13. [Example User Workflows](#example-user-workflows)

---

## Skill Information

### Skill Name
**heritage-qc** (Heritage Digitization Quality Control)

**Full Name:** Heritage QC - Image Validation Skill for Claude

**Purpose:** Professional image validation for heritage digitization workflows. Validate image deliverables against client specifications, generate actionable reports, and ensure quality before delivery.

### Supported Formats
- **TIFF** (.tif, .tiff) - Primary format for archival masters
- **RAW formats** (.raw, .arw, .dng, .nef, .cr2, .cr3, .orf) - Camera raw files
- **JPEG** (.jpg, .jpeg) - Access derivatives (future)
- **PNG** (.png) - Alternative format (future)

**Note:** Initial release focuses on TIFF and RAW formats as these are most common in heritage digitization workflows.

---

## Project Overview

### Mission Statement
Create a Claude skill that validates heritage digitization images against client specifications, provides actionable feedback, and supports iterative quality improvement workflows.

### Key Objectives
1. **Parse** natural language client requirements → structured configuration
2. **Extract** EXIF metadata from 100-10,000 TIFF images
3. **Validate** images against specifications (dimensions, bit depth, EXIF, structure)
4. **Report** failures with actionable categorization (critical, fixable, warnings)
5. **Generate** fix scripts for correctable issues
6. **Track** validation iterations with versioning

### Target Users
- Digital archivists
- Heritage digitization technicians
- Cultural institution staff

### Technical Constraints
- Runtime: Bun (TypeScript/JavaScript)
- Database: SQLite (built-in to Bun)
- External tools: ExifTool (CLI), JHOVE (CLI, TIFF only)
- Storage: Local filesystem (NAS/external drives supported)
- Supported formats: TIFF (.tif, .tiff), RAW (.dng, .arw, .nef, .cr2, .cr3, .orf, .raw, .raf, .rw2)
- No network dependencies
- No team/collaboration features required
- Project-based organization (all outputs in project directory)
- User specifies image directory path

### Success Metrics
- Parse 95%+ of client requirement documents accurately
- Extract EXIF from 1,000 images in <10 minutes
- JHOVE validation <10 seconds per image average
- Zero false positives on validation
- Generate actionable reports in <5 seconds
- Support batches up to 10,000 images

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Claude                              │
│                    (Orchestration)                          │
└────────────────┬────────────────────────────┬───────────────┘
                 │                            │
                 ▼                            ▼
┌────────────────────────────┐   ┌──────────────────────────┐
│   Configuration Layer      │   │   Execution Layer        │
├────────────────────────────┤   ├──────────────────────────┤
│ - Parse requirements       │   │ - EXIF extraction        │
│ - Generate YAML config     │   │ - JHOVE validation       │
│ - Validate config schema   │   │ - Spec validation        │
│ - Template library         │   │ - Progress tracking      │
└────────────────────────────┘   └──────────────────────────┘
                 │                            │
                 └────────────┬───────────────┘
                              ▼
                 ┌────────────────────────────┐
                 │    Data Layer (SQLite)     │
                 ├────────────────────────────┤
                 │ - Images & EXIF data       │
                 │ - Validation results       │
                 │ - Task progress            │
                 │ - Audit trail              │
                 └────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
    ┌───────────────────────┐  ┌──────────────────────┐
    │   Reporting Layer     │  │   Utilities Layer    │
    ├───────────────────────┤  ├──────────────────────┤
    │ - HTML interactive    │  │ - System file cleanup│
    │ - Markdown summary    │  │ - Filename validation│
    │ - CSV exports         │  │ - Fix script gen     │
    │ - Fix scripts         │  │ - Comparison tools   │
    └───────────────────────┘  └──────────────────────┘
```

### Data Flow

```
User specifies image directory path
         │
         ▼
Client Requirements (PDF/DOCX)
         │
         ▼
    [AI Parser] → project-spec.yaml (user editable)
         │
         ▼
    [Config Validator]
         │
         ▼
    [Image Scanner] → Detect TIFF/RAW files in user path
         │
         ▼
    [EXIF Extractor] → SQLite DB (all formats via ExifTool)
         │
         ├─→ [JHOVE Validator] → SQLite DB (TIFF only)
         │
         └─→ [RAW Validator] → SQLite DB (RAW only - basic checks)
         │
         ▼
    [Spec Validator] → SQLite DB (all formats)
         │
         ▼
    [Report Generator] → HTML/MD/CSV in reports/
         │
         ▼
    [Fix Script Gen] → Shell script in outputs/
         │
         ▼
    User applies fixes
         │
         ▼
    [Re-validation] → Updated reports (v2, v3...) in reports/
```

**Key Points:**
- User provides image directory path (can be anywhere)
- TIFF files get JHOVE validation
- RAW files get basic validity checks (no JHOVE)
- Both get full EXIF extraction
- All outputs saved to project directory

### File System Structure

**Project-Based Structure (Recommended):**
```
/path/to/my-project/                    # User-specified project directory
├── heritage-qc/                        # Skill installed in project
│   ├── src/                           # Source code
│   ├── templates/                     # Config templates
│   ├── schemas/                       # Data schemas
│   └── package.json
│
├── images/                             # User specifies this path
│   ├── IMG_0001.tif
│   ├── IMG_0002.tif
│   └── ...
│
├── project-spec.yaml                   # User-editable config
├── validation.db                       # SQLite database
├── progress.json                       # Real-time progress
│
├── reports/                            # Generated reports
│   ├── validation_report_v1.html
│   ├── validation_report_v1.md
│   ├── validation_report_v2.html
│   └── validation_report_v2.md
│
├── outputs/                            # Generated outputs
│   ├── failed_images_v1.csv
│   ├── failed_images_v2.csv
│   └── fix_exif_v1.sh
│
└── logs/                               # Execution logs
    ├── exif-extraction.log
    └── jhove-validation.log
```

**Global Installation (Alternative):**
```
~/.heritage-qc/                         # Global skill installation
├── src/
├── templates/
├── schemas/
└── package.json

/path/to/my-project/                    # User project (lightweight)
├── images/                             # Image directory
├── project-spec.yaml
├── validation.db
├── reports/
├── outputs/
└── logs/
```

**Claude Skills Directory (For Claude App Integration):**
```
/mnt/skills/user/heritage-qc/           # Skill files
├── SKILL.md                            # Claude instructions
├── README.md
├── src/
├── templates/
└── schemas/
```

**Key Principles:**
- User specifies image directory path (can be anywhere)
- All generated files stay in project directory
- Skill can be project-local or global
- Project directory is portable (can be archived with deliverables)

---

## Implementation Phases

### Phase 1: Foundation (Week 1) [COMPLETED]
**Goal:** Core infrastructure and data layer

**Components:**
- Database schema implementation ✅
- Configuration schema (TypeScript types + JSON Schema) ✅
- Base utilities (file handling, progress tracking) ✅
- Development setup (package.json, tsconfig, testing framework) ✅

**Deliverables:**
- Working SQLite database with schema
- TypeScript type definitions
- Progress tracking utility
- Unit test framework

**Success Criteria:**
- Can create and query database
- Types compile without errors
- Progress tracker writes/reads JSON
- Tests run successfully

### Phase 2: Configuration System (Week 1) [COMPLETED]
**Goal:** Config parsing, validation, and templates

**Components:**
- YAML config parser (src/config/parse-config.ts) ✅
- Config validator with schema checking (src/config/validate-config.ts) ✅
- Template library (templates/*.yaml, src/config/templates.ts) ✅
- Config diff/comparison utility (Future enhancement)

**Deliverables:**
- parse-config.ts
- validate-config.ts
- Template YAML files
- Config schema documentation

**Success Criteria:**
- Can parse YAML configs
- Validation catches schema errors
- Templates load correctly
- Can detect config differences (Partial - schema catches differences)

### Phase 3: EXIF Extraction (Week 2) [COMPLETED]
**Goal:** Reliable EXIF extraction and storage from TIFF and RAW files

**Components:**
- ExifTool wrapper (supports all formats) ✅
- File type detection (TIFF vs RAW) ✅
- Batch processing with progress ✅
- Database insertion with transactions ✅
- Error handling and logging ✅
- Use ExifTool `-@ argfile` option for batch processing (avoids OS command line length limits) ✅

**Deliverables:**
- extract-exif.ts (handles TIFF, DNG, ARW, NEF, CR2, CR3, ORF, etc.)
- File scanner with format detection
- Batch processing (chunks of 100)
- Progress updates to JSON
- Error logs

**Success Criteria:**
- Extract EXIF from 1,000 images in <10 min (mixed TIFF/RAW)
- Correctly identify file types
- Handle corrupted files gracefully
- Accurate progress reporting
- All EXIF data stored correctly
- Support all major RAW formats

### Phase 4: Format-Specific Validation (Week 2) [COMPLETED]
**Goal:** TIFF structure validation and RAW file checks

**Components:**
- JHOVE CLI wrapper (TIFF only) ✅
- JHOVE XML output parser ✅
- RAW file validator (basic checks) ✅
- Result storage in database (Ready for integration)
- Resumable processing (checkpoint/resume) (Part of orchestration)
- JHOVE optimization: batch multiple files per invocation (reduces JVM startup overhead) ✅
- Optional parallel JHOVE workers (pool of 2-4) for large batches (Ready for integration)

**Deliverables:**
- run-jhove.ts (TIFF files only)
- validate-raw.ts (basic RAW checks)
- XML parser for JHOVE output
- Unit tests for JHOVE wrapper/parser and RAW validator
- Resume capability
- Progress tracking

**Success Criteria:**
- Validate 100 TIFF images without errors
- Parse JHOVE XML correctly
- Detect RAW files and skip JHOVE
- Run basic RAW validity checks (readable, has EXIF)
- Can resume interrupted validation
- Progress updates accurate

**Note:** JHOVE only supports TIFF validation. RAW files use ExifTool-based validation to check file readability and metadata presence.

### Phase 5: Specification Validation (Week 3) [COMPLETED]
**Goal:** Validate against client specs

**Components:**
- Dimension checker ✅
- Bit depth validator ✅
- EXIF tag validator (presence + values) ✅
- Color space checker ✅
- Resolution validator (Part of dimensions) ✅
- Categorization engine (critical/fixable/warning) ✅

**Deliverables:**
- validate-specs.ts (renamed to spec-validator.ts)
- Individual validators
- Severity classification
- Fixability detection

**Success Criteria:**
- Correctly identifies all failure types
- Accurate severity classification
- No false positives
- Can validate 5,000 images in <1 min (excluding JHOVE)

### Phase 6: Reporting (Week 3-4)
**Goal:** Generate actionable reports

**Components:**
- HTML report generator (with embedded SQL.js)
- Markdown summary generator
- CSV export utility
- Interactive report template
- Bundle SQL.js locally (sql-wasm.js + sql-wasm.wasm) for air-gapped archive environments

**Deliverables:**
- generate-html-report.ts
- generate-markdown.ts
- generate-csv.ts
- interactive-report.html template

**Success Criteria:**
- HTML report works offline
- Can query embedded database
- Markdown summary accurate
- CSV exports properly formatted

### Phase 7: Fix Generation (Week 4)
**Goal:** Generate executable fix scripts

**Components:**
- EXIF fix analyzer
- Shell script generator
- Fix validation
- Batch optimization
- Rigorous shell escaping for file paths (use `shell-quote` or equivalent to prevent injection)

**Deliverables:**
- generate-fix-script.ts
- exif-fixes.ts
- Script templates

**Success Criteria:**
- Generates valid shell scripts
- Scripts are reviewable
- Handles batch operations
- Includes safety checks

### Phase 8: Utilities (Week 4-5)
**Goal:** Additional workflow tools

**Components:**
- System file cleanup
- Filename validation
- Comparison tools (v1 vs v2)
- Deliverable package builder
- Signal handling (SIGINT/SIGTERM) for graceful shutdown (close DB, save progress)

**Deliverables:**
- remove-system-files.ts
- validate-filenames.ts
- compare-validations.ts

**Success Criteria:**
- System files removed correctly
- Filename issues detected
- Comparison shows improvements
- Package builder creates clean deliverables

### Phase 9: Integration & SKILL.md (Week 5)
**Goal:** Integrate components and document

**Components:**
- SKILL.md orchestration guide
- End-to-end workflow testing
- Error handling improvements
- Performance optimization

**Deliverables:**
- Complete SKILL.md
- Integration tests
- Performance benchmarks
- User documentation

**Success Criteria:**
- Claude can execute full workflow
- All components work together
- Meets performance targets
- Documentation complete

---

## Component Breakdown

*[TRUNCATED - Document contains detailed breakdowns of all 12 components with inputs, outputs, dependencies, testing requirements, and PRD focus areas. Each component section follows this structure:]*

*Component Name → Purpose → Inputs → Outputs → Core Logic → Dependencies → Testing → PRD Focus*

---

## Data Models

*[Contains complete TypeScript interfaces and SQL schema - see full document]*

---

## Configuration Schema Validation

### JSON Schema for YAML Configuration

**Why JSON Schema:**
- Industry standard with excellent tooling
- YAML parses to JSON-compatible structures
- Provides IDE autocomplete and inline validation
- Generates TypeScript types automatically
- Clear error messages for invalid configs

### Schema Location

```
schemas/
├── config-schema.json          # Main JSON Schema
├── config-schema.ts            # Auto-generated TypeScript types
└── exif-tags-reference.json    # Valid EXIF tag names
```

### Schema Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://heritage-qc.dev/schemas/project-spec.json",
  "title": "Heritage QC Project Specification",
  "type": "object",
  "required": ["project", "format", "validation"],
  
  "properties": {
    "project": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "client": { "type": "string" },
        "date": { "type": "string", "format": "date" }
      }
    },
    
    "format": {
      "type": "object",
      "required": ["file_type"],
      "properties": {
        "file_type": {
          "type": "string",
          "enum": ["TIFF", "RAW", "JPEG", "PNG"]
        },
        "allowed_extensions": {
          "type": "array",
          "items": { "type": "string", "pattern": "^\\.[a-z0-9]+$" }
        },
        "enforce_single_type": {
          "type": "boolean",
          "default": true,
          "description": "Warn if other file types found in directory"
        }
      },
      "allOf": [{
        "if": { "properties": { "file_type": { "const": "RAW" } } },
        "then": { "required": ["raw_format"] }
      }]
    },
    
    "dimensions": {
      "properties": {
        "min_long_edge": { 
          "type": "integer", 
          "minimum": 100, 
          "maximum": 100000 
        }
      }
    },
    
    "color": {
      "required": ["bit_depth"],
      "properties": {
        "bit_depth": { "type": "integer", "enum": [8, 16, 32] }
      }
    },
    
    "validation": {
      "required": ["run_jhove"],
      "properties": {
        "run_jhove": { "type": "boolean" },
        "check_raw_validity": { "type": "boolean" }
      }
    }
  }
}
```

### Validation Implementation

```typescript
// src/config/validate-config.ts
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "yaml";

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export async function validateConfig(
  configPath: string
): Promise<ValidationResult> {
  
  // Load schema
  const schema = await Bun.file("schemas/config-schema.json").json();
  const validate = ajv.compile(schema);
  
  // Load and parse YAML config
  const configYaml = await Bun.file(configPath).text();
  const config = yaml.parse(configYaml);
  
  // Run JSON Schema validation
  const valid = validate(config);
  
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Collect schema errors
  if (!valid && validate.errors) {
    for (const error of validate.errors) {
      errors.push({
        path: error.instancePath,
        message: error.message || "Validation error",
        value: error.data
      });
    }
  }
  
  // Semantic validation (logical consistency)
  if (valid) {
    // RAW files shouldn't use JHOVE
    if (config.format?.file_type === "RAW" && 
        config.validation?.run_jhove === true) {
      warnings.push({
        path: "validation.run_jhove",
        message: "JHOVE doesn't support RAW files",
        suggestion: "Set run_jhove: false for RAW projects"
      });
    }
    
    // Check EXIF tag names against known tags
    const validExifTags = await loadValidExifTags();
    for (const req of config.required_exif || []) {
      if (!validExifTags.includes(req.tag)) {
        warnings.push({
          path: `required_exif.${req.tag}`,
          message: `"${req.tag}" is not a standard EXIF tag`,
          suggestion: findSimilarTag(req.tag, validExifTags)
        });
      }
    }
    
    // Unrealistic dimensions
    if (config.dimensions?.min_long_edge > 20000) {
      warnings.push({
        path: "dimensions.min_long_edge",
        message: "Very large dimension (>20000px)",
        suggestion: "Typical values: 3000-10000px"
      });
    }
  }
  
  return { valid: valid && errors.length === 0, errors, warnings };
}
```

### VS Code Integration

Enable autocomplete and inline validation by adding schema reference to YAML:

```yaml
# project-spec.yaml
$schema: ./heritage-qc/schemas/config-schema.json

project:
  name: "Museum Project 2025"
  # VS Code now provides:
  # - Autocomplete for all fields
  # - Inline validation errors
  # - Hover documentation
  # - Enum suggestions
```

### TypeScript Type Generation

Auto-generate TypeScript types from JSON Schema:

```bash
# Install generator
bun add -d json-schema-to-typescript

# Generate types
bunx json-schema-to-typescript \
  schemas/config-schema.json \
  -o schemas/config-schema.ts
```

Generated types are then imported:

```typescript
import { ProjectSpec } from "../schemas/config-schema";

function validateAgainstSpec(config: ProjectSpec) {
  // TypeScript knows all the fields and types
}
```

### Validation Error Messages

```bash
$ bun run src/config/validate-config.ts project-spec.yaml

❌ Configuration has errors:

  /color/bit_depth
    must be equal to one of the allowed values
    Current value: 24
    Allowed values: 8, 16, 32

  /required_exif/0
    must have required property 'tag'

⚠️  Warnings:

  validation.run_jhove
    JHOVE doesn't support RAW files
    💡 Set run_jhove: false for RAW projects

  required_exif.CameraModel
    "CameraModel" is not a standard EXIF tag
    💡 Did you mean "Model"?
```

### Dependencies

```json
{
  "dependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "json-schema-to-typescript": "^13.1.1",
    "@types/node": "latest"
  }
}
```

### Benefits

1. **Pre-flight Validation** - Catch config errors before running validation
2. **IDE Support** - Autocomplete, inline errors, documentation
3. **Type Safety** - Generated TypeScript types
4. **Clear Errors** - Helpful messages with suggestions
5. **Documentation** - Schema serves as specification

---

## Multi-Directory Validation Strategy

### Common Directory Structure

Heritage digitization projects typically have multiple directories with different file types:

```
project-root/
├── raw/                    # Camera RAW files (.dng, .arw, .nef)
├── deliverable/           # TIFF masters (.tif)
├── web/                   # JPEG access copies (.jpg)
└── metadata/              # Sidecar files (.xml, .xmp)
```

### Validation Approach: One Config Per Directory

**Principle:** Each directory with images gets its own configuration file tailored to its file type.

**Project Structure:**

```
my-project/
├── heritage-qc/           # Skill installation
│
├── raw/                   # RAW originals
│   ├── images/            # User specifies: ./raw/images/
│   │   ├── IMG_0001.dng
│   │   └── IMG_0002.dng
│   ├── raw-spec.yaml      # Config for RAW files
│   ├── validation.db
│   ├── reports/
│   └── outputs/
│
├── deliverable/           # TIFF masters
│   ├── images/            # User specifies: ./deliverable/images/
│   │   ├── IMG_0001.tif
│   │   └── IMG_0002.tif
│   ├── deliverable-spec.yaml  # Config for TIFF files
│   ├── validation.db
│   ├── reports/
│   └── outputs/
│
└── web/                   # JPEG derivatives
    ├── images/            # User specifies: ./web/images/
    │   ├── IMG_0001.jpg
    │   └── IMG_0002.jpg
    ├── web-spec.yaml      # Config for JPEG files
    ├── validation.db
    ├── reports/
    └── outputs/
```

### Configuration Per Directory

**raw/raw-spec.yaml:**
```yaml
$schema: ../heritage-qc/schemas/config-schema.json

project:
  name: "Museum Project - RAW Originals"
  
format:
  file_type: "RAW"
  allowed_extensions: [".dng", ".arw"]
  enforce_single_type: true    # Warn if TIFF/JPEG found
  
dimensions:
  min_long_edge: 6000
  
required_exif:
  - tag: "Make"
  - tag: "Model"
  - tag: "LensModel"
  
validation:
  run_jhove: false             # RAW files
  check_raw_validity: true
```

**deliverable/deliverable-spec.yaml:**
```yaml
$schema: ../heritage-qc/schemas/config-schema.json

project:
  name: "Museum Project - TIFF Masters"
  
format:
  file_type: "TIFF"
  allowed_extensions: [".tif", ".tiff"]
  enforce_single_type: true    # Warn if RAW/JPEG found
  compression: "Uncompressed"
  
dimensions:
  min_long_edge: 8000          # Higher than RAW
  
color:
  bit_depth: 16
  
required_exif:
  - tag: "Make"
  - tag: "Model"
  - tag: "Artist"              # Added for deliverables
  
validation:
  run_jhove: true              # Full TIFF validation
```

**web/web-spec.yaml:**
```yaml
$schema: ../heritage-qc/schemas/config-schema.json

project:
  name: "Museum Project - Web Access Copies"
  
format:
  file_type: "JPEG"
  allowed_extensions: [".jpg", ".jpeg"]
  enforce_single_type: true
  compression: "JPEG"
  
dimensions:
  min_long_edge: 2000          # Lower for web
  
color:
  bit_depth: 8                 # JPEG is 8-bit
  
validation:
  run_jhove: false
```

### File Type Enforcement

**Scanner with Type Checking:**

```typescript
// src/utils/scan-images.ts

interface ScanResult {
  matched: FileInfo[];      // Files matching config
  mismatched: FileInfo[];   // Files NOT matching config
  summary: ScanSummary;
}

interface FileInfo {
  path: string;
  filename: string;
  extension: string;
  detectedType: "TIFF" | "RAW" | "JPEG" | "PNG" | "UNKNOWN";
}

async function scanDirectory(
  imageDir: string,
  config: ProjectSpec
): Promise<ScanResult> {
  
  const allFiles = await getAllFiles(imageDir);
  const matched: FileInfo[] = [];
  const mismatched: FileInfo[] = [];
  
  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    const detectedType = detectFileType(ext);
    
    // Check if extension is in allowed list
    const allowed = config.format.allowed_extensions || [];
    const isAllowed = allowed.includes(ext);
    
    if (isAllowed) {
      matched.push({ path: file, filename: path.basename(file), extension: ext, detectedType });
    } else if (isImageFile(ext)) {
      // It's an image but not the expected type
      mismatched.push({ path: file, filename: path.basename(file), extension: ext, detectedType });
    }
  }
  
  return {
    matched,
    mismatched,
    summary: {
      totalMatched: matched.length,
      totalMismatched: mismatched.length,
      byType: groupByType(matched, mismatched)
    }
  };
}

function detectFileType(ext: string): string {
  const tiffExts = ['.tif', '.tiff'];
  const rawExts = ['.dng', '.arw', '.nef', '.cr2', '.cr3', '.orf', '.raw', '.raf', '.rw2'];
  const jpegExts = ['.jpg', '.jpeg'];
  const pngExts = ['.png'];
  
  if (tiffExts.includes(ext)) return 'TIFF';
  if (rawExts.includes(ext)) return 'RAW';
  if (jpegExts.includes(ext)) return 'JPEG';
  if (pngExts.includes(ext)) return 'PNG';
  return 'UNKNOWN';
}
```

### Warning Messages

When mismatched files are detected:

```
⚠️  File Type Mismatch Warning

Expected: TIFF files (.tif, .tiff)
Found in directory:

Matched (will be validated):
  ✓ 523 TIFF files

Mismatched (will be SKIPPED):
  ⚠ 46 DNG files (RAW format)
  ⚠ 12 JPG files (JPEG format)

These files will not be validated with the current configuration.

Options:
1. Move mismatched files to appropriate directories
2. Create separate configs for each file type
3. Update config to allow multiple types (not recommended)

Proceed with validating only TIFF files? (y/n)
```

### User Workflow

```
User: "Validate my museum project. I have RAW files in /archive/raw/ 
and TIFF files in /archive/deliverable/"

Claude:
I see you have multiple directories with different file types. 
I'll validate each directory separately with appropriate configs.

Let's start with the RAW files.

[Creates raw/raw-spec.yaml]
[Validates raw/ directory]

✓ RAW validation complete: 523/523 passed

Now for the TIFF deliverables.

[Creates deliverable/deliverable-spec.yaml]
[Validates deliverable/ directory]

✓ TIFF validation complete: 520/523 passed (3 failures)

Summary across all directories:
- RAW originals: 523/523 ✓
- TIFF masters: 520/523 (3 need fixes)

Reports generated:
- raw/reports/validation_report_v1.html
- deliverable/reports/validation_report_v1.html
```

### Combined Reporting (Optional Future Feature)

```typescript
// Future enhancement: Multi-directory summary

interface ProjectSummary {
  directories: DirectorySummary[];
  overall: OverallStats;
}

async function generateProjectSummary(
  directories: string[]
): Promise<ProjectSummary> {
  
  const summaries: DirectorySummary[] = [];
  
  for (const dir of directories) {
    const db = await openDatabase(`${dir}/validation.db`);
    const summary = await getValidationSummary(db);
    summaries.push({
      path: dir,
      fileType: detectDirectoryType(dir),
      ...summary
    });
  }
  
  return {
    directories: summaries,
    overall: calculateOverallStats(summaries)
  };
}
```

### SKILL.md Guidance

```markdown
## Multi-Directory Projects

If user has multiple directories with different file types:

1. Ask which directory to validate first
2. Create appropriate config for that directory's file type
3. Run validation
4. Offer to validate next directory
5. Repeat for each directory

Example:
```
User: "I have RAW and TIFF directories"

Claude: "Let's validate each separately. Which directory first?"

User: "Start with RAW in /archive/raw/images/"

Claude: 
[Scans directory]
Found 523 DNG files (RAW format)

Creating raw-spec.yaml for RAW validation...
[validation proceeds]

Ready to validate TIFF directory?
```

## File Type Enforcement Rules

1. **Default Behavior:** Warn about mismatched files, skip them
2. **Config Setting:** `enforce_single_type: true` (default)
3. **User Override:** Can disable warnings (not recommended)
4. **Claude Behavior:** Always ask before proceeding if mismatches found

## When to Use Single vs Multi-Directory

**Single Directory (One Config):**
- All files are same type
- Simple validation task
- Quick QC check

**Multi-Directory (Multiple Configs):**
- Different file types (RAW, TIFF, JPEG)
- Different requirements per type
- Complete project validation
- Organized deliverable structure

### Best Practices

1. **One config per file type/directory**
2. **Clear directory naming** (raw/, deliverable/, web/)
3. **Separate databases** (prevents confusion)
4. **Independent reports** (easier to review)
5. **Warn on type mismatches** (catches organizational errors)
```

### Configuration Schema Addition

Add to `config-schema.json`:

```json
{
  "format": {
    "properties": {
      "enforce_single_type": {
        "type": "boolean",
        "default": true,
        "description": "Warn if files of other types are found in directory"
      },
      "skip_mismatched": {
        "type": "boolean", 
        "default": true,
        "description": "Skip files that don't match expected type"
      }
    }
  }
}
```

---

## Interface Specifications

*[Contains CLI patterns, progress format, exit codes - see full document]*

---

## Testing Strategy

*[Contains unit test, integration test, performance test, and error handling test requirements - see full document]*

---

## PRD Generation Template

When creating a PRD for any component, use this structure:

```markdown
# PRD: [Component Name]

## Overview
- **Purpose:** One-line description
- **Scope:** What's included/excluded
- **Success Criteria:** How we know it works

## Requirements
### Functional Requirements
1. MUST [requirement]
2. SHOULD [requirement]
3. MAY [requirement]

### Non-Functional Requirements
- Performance: [targets]
- Reliability: [targets]
- Usability: [targets]

## Technical Specification
### Inputs
[List with types]

### Outputs
[List with types]

### Algorithm
[Step-by-step logic]

### Dependencies
[External tools, internal modules]

## Implementation
### File Location
`src/[path]/[filename].ts`

### Key Functions
```typescript
[Function signatures with JSDoc]
```

### Error Handling
- [Error type] → [How to handle]

## Testing
### Unit Tests
- [Test case 1]
- [Test case 2]

### Integration Tests
- [Test scenario]

### Performance Benchmarks
- [Metric]: [Target]

## Examples
### CLI Usage
```bash
[Command with options]
```

### Programmatic Usage
```typescript
[Code example]
```

## Edge Cases
1. [Edge case] → [Expected behavior]

## Documentation
- Code: JSDoc on all public functions
- User: Section in README/SKILL.md
- API: Interface documentation
```

---

## Success Criteria for Implementation

A component is complete when:

1. ✅ **Code compiles** without errors
2. ✅ **Unit tests pass** with >80% coverage
3. ✅ **Integration tests pass** with other components
4. ✅ **Performance targets met** according to specs
5. ✅ **Error handling works** for all known failure modes
6. ✅ **Documentation complete** (code, user, API)
7. ✅ **CLI interface** follows standard patterns
8. ✅ **Logging** provides useful debug information
9. ✅ **Progress tracking** works for long operations
10. ✅ **Code reviewed** for quality and style

---

## Next Steps for AI Agents

1. **Read this entire document** to understand the full system
2. **Request a specific component PRD** to implement
3. **Follow the PRD** strictly for implementation
4. **Write tests first** (TDD approach recommended)
5. **Implement incrementally** with frequent testing
6. **Document as you go** (don't leave it for later)
7. **Test integration** with other components
8. **Request code review** before marking complete

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-19  
**Maintained By:** Project architect  
**Next Review:** After Phase 1 completion

---

## Distribution & Installation

### Installation Methods

**Method 1: Project-Based Installation (Recommended)**

Best for: Individual projects, portable setups, archiving with deliverables

```bash
# Create new project
mkdir my-validation-project
cd my-validation-project

# Install skill in project
curl -fsSL https://raw.githubusercontent.com/[user]/heritage-qc/main/install.sh | bash -s -- --local

# Directory structure created:
# my-validation-project/
# ├── heritage-qc/          (skill files)
# ├── images/               (create and add your images)
# ├── project-spec.yaml     (will be created)
# └── reports/              (will be created)
```

**Method 2: Global Installation**

Best for: Multiple projects, shared skill across team, system-wide availability

```bash
# Install globally
curl -fsSL https://raw.githubusercontent.com/[user]/heritage-qc/main/install.sh | bash -s -- --global

# Skill installed to: ~/.heritage-qc/
# Use from any project directory
```

**Method 3: Claude Skills Directory**

Best for: Claude Desktop/Code integration

```bash
# Install to Claude skills directory
curl -fsSL https://raw.githubusercontent.com/[user]/heritage-qc/main/install.sh | bash -s -- --claude

# Skill installed to: /mnt/skills/user/heritage-qc/
# Available automatically in Claude
```

### Installation Script (install.sh)

```bash
#!/bin/bash
# Heritage QC Skill Installer
# Usage: ./install.sh [--local|--global|--claude]

set -e

VERSION="1.0.0"
REPO="https://github.com/[user]/heritage-qc"

# Parse arguments
INSTALL_MODE="local"  # default
while [[ $# -gt 0 ]]; do
  case $1 in
    --local)   INSTALL_MODE="local"; shift ;;
    --global)  INSTALL_MODE="global"; shift ;;
    --claude)  INSTALL_MODE="claude"; shift ;;
    *)         echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "🏛️  Installing Heritage QC v${VERSION}..."
echo "Installation mode: ${INSTALL_MODE}"

# Check prerequisites
echo ""
echo "Checking prerequisites..."

# Check Bun
if ! command -v bun &> /dev/null; then
    echo "📦 Installing Bun runtime..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi
echo "✓ Bun installed: $(bun --version)"

# Check ExifTool
if ! command -v exiftool &> /dev/null; then
    echo ""
    echo "⚠️  ExifTool not found (required for EXIF extraction)"
    echo ""
    echo "Install instructions:"
    echo "  macOS:   brew install exiftool"
    echo "  Ubuntu:  sudo apt-get install libimage-exiftool-perl"
    echo "  Debian:  sudo apt-get install libimage-exiftool-perl"
    echo "  Arch:    sudo pacman -S perl-image-exiftool"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ ExifTool installed: $(exiftool -ver)"
fi

# Check JHOVE (optional but recommended)
if ! command -v jhove &> /dev/null; then
    echo ""
    echo "⚠️  JHOVE not found (recommended for TIFF validation)"
    echo ""
    echo "Download from: https://jhove.openpreservation.org/"
    echo "Or skip TIFF structure validation (faster but less thorough)"
    echo ""
fi

# Determine installation directory
if [ "$INSTALL_MODE" = "global" ]; then
    INSTALL_DIR="$HOME/.heritage-qc"
elif [ "$INSTALL_MODE" = "claude" ]; then
    if [ -d "/mnt/skills/user" ]; then
        INSTALL_DIR="/mnt/skills/user/heritage-qc"
    else
        echo "❌ Claude skills directory not found"
        exit 1
    fi
else
    # Local installation
    INSTALL_DIR="$(pwd)/heritage-qc"
fi

echo ""
echo "Installing to: $INSTALL_DIR"

# Download or clone repository
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Directory exists. Updating..."
    cd "$INSTALL_DIR"
    git pull || echo "Not a git repo, skipping update"
else
    echo "📥 Downloading skill..."
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install dependencies
if [ -f "package.json" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    bun install
fi

# Create project structure for local installation
if [ "$INSTALL_MODE" = "local" ]; then
    PROJECT_DIR="$(dirname "$INSTALL_DIR")"
    echo ""
    echo "Setting up project structure..."
    
    mkdir -p "$PROJECT_DIR/images"
    mkdir -p "$PROJECT_DIR/reports"
    mkdir -p "$PROJECT_DIR/outputs"
    mkdir -p "$PROJECT_DIR/logs"
    
    # Copy example config if not exists
    if [ ! -f "$PROJECT_DIR/project-spec.yaml" ]; then
        cp "$INSTALL_DIR/templates/basic-spec.yaml" "$PROJECT_DIR/project-spec.yaml"
        echo "✓ Created example project-spec.yaml"
    fi
    
    # Create .gitignore
    cat > "$PROJECT_DIR/.gitignore" << 'EOF'
# Heritage QC generated files
validation.db
progress.json
*.log
reports/
outputs/
logs/

# System files
.DS_Store
._*
Thumbs.db
EOF
    
    # Create README
    cat > "$PROJECT_DIR/README.md" << 'EOF'
# Heritage QC Validation Project

This directory contains validation configuration and outputs for image quality control.

## Structure

- `images/` - Place your images here (TIFF, RAW, etc.)
- `project-spec.yaml` - Edit this to define validation requirements
- `reports/` - Generated validation reports (HTML, Markdown)
- `outputs/` - Generated outputs (CSV, fix scripts)
- `logs/` - Execution logs

## Quick Start

1. Add images to the `images/` directory
2. Edit `project-spec.yaml` to match client requirements
3. Tell Claude: "Validate the images in this project"

## Commands

All commands should be run from this project directory.

Validate config:
```bash
bun run heritage-qc/src/config/validate-config.ts project-spec.yaml
```

Run validation:
```bash
# Claude will orchestrate this
```

View templates:
```bash
ls heritage-qc/templates/
```

EOF
fi

# Add to PATH for global installation
if [ "$INSTALL_MODE" = "global" ]; then
    echo ""
    echo "Adding to PATH..."
    SHELL_RC="$HOME/.bashrc"
    [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"
    
    if ! grep -q "heritage-qc" "$SHELL_RC"; then
        echo 'export PATH="$HOME/.heritage-qc/bin:$PATH"' >> "$SHELL_RC"
        echo "✓ Added to $SHELL_RC"
        echo "  Run: source $SHELL_RC"
    fi
fi

# Verify installation
echo ""
echo "Verifying installation..."
if bun run src/config/validate-config.ts templates/basic-spec.yaml > /dev/null 2>&1; then
    echo "✓ Validation successful"
else
    echo "⚠️  Validation test had issues (may be OK)"
fi

# Success message
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Heritage QC installed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$INSTALL_MODE" = "local" ]; then
    echo "Project directory: $(dirname "$INSTALL_DIR")"
    echo ""
    echo "Next steps:"
    echo "  1. Add images to: images/"
    echo "  2. Edit: project-spec.yaml"
    echo "  3. Tell Claude: 'Validate the images in this project'"
    echo ""
    echo "Documentation: heritage-qc/README.md"
elif [ "$INSTALL_MODE" = "global" ]; then
    echo "Installation directory: $INSTALL_DIR"
    echo ""
    echo "Next steps:"
    echo "  1. Create a project directory"
    echo "  2. Add images"
    echo "  3. Create project-spec.yaml"
    echo "  4. Tell Claude: 'Use heritage-qc to validate images'"
    echo ""
    echo "Templates: ~/.heritage-qc/templates/"
else
    echo "Claude skills directory: $INSTALL_DIR"
    echo ""
    echo "The skill is now available in Claude."
    echo "Just say: 'Validate my images using heritage-qc'"
fi

echo ""
echo "Support: $REPO/issues"
echo "Version: $VERSION"
```

### Distribution Package Structure

```
heritage-qc/                            # GitHub repository
├── .github/
│   ├── workflows/
│   │   ├── tests.yml                   # CI/CD
│   │   └── release.yml
│   └── ISSUE_TEMPLATE/
│
├── src/                                # Source code
│   ├── config/
│   │   ├── parse-requirements.ts
│   │   ├── validate-config.ts
│   │   └── config-templates.ts
│   ├── extraction/
│   │   ├── extract-exif.ts
│   │   └── extract-file-info.ts
│   ├── validation/
│   │   ├── run-jhove.ts
│   │   ├── validate-specs.ts
│   │   └── validate-filenames.ts
│   ├── reporting/
│   │   ├── generate-html-report.ts
│   │   ├── generate-markdown.ts
│   │   └── generate-csv.ts
│   ├── fixes/
│   │   └── generate-fix-script.ts
│   ├── cleanup/
│   │   └── remove-system-files.ts
│   └── utils/
│       ├── progress-tracker.ts
│       ├── db-schema.ts
│       └── query-helpers.ts
│
├── schemas/                            # Data schemas
│   ├── database.sql
│   ├── config-schema.ts
│   └── config-schema.json
│
├── templates/                          # Config templates
│   ├── basic-spec.yaml
│   ├── museum-spec.yaml
│   ├── archive-spec.yaml
│   ├── tiff-only-spec.yaml
│   └── raw-only-spec.yaml
│
├── examples/                           # Example projects
│   ├── museum-project/
│   │   ├── project-spec.yaml
│   │   └── README.md
│   └── archive-project/
│       ├── project-spec.yaml
│       └── README.md
│
├── docs/                               # Documentation
│   ├── getting-started.md
│   ├── configuration.md
│   ├── workflows.md
│   ├── supported-formats.md
│   ├── api-reference.md
│   └── troubleshooting.md
│
├── tests/                              # Test suite
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│       ├── valid-tiff.tif
│       ├── valid-dng.dng
│       └── configs/
│
├── bin/                                # CLI executables (optional)
│   └── heritage-qc
│
├── SKILL.md                            # Claude skill instructions
├── README.md                           # Main documentation
├── LICENSE                             # MIT recommended
├── CHANGELOG.md                        # Version history
├── CONTRIBUTING.md                     # Contribution guidelines
├── install.sh                          # Installation script
├── package.json                        # Bun package config
├── tsconfig.json                       # TypeScript config
└── .gitignore

**package.json:**
```json
{
  "name": "heritage-qc",
  "version": "1.0.0",
  "description": "Image validation for heritage digitization workflows",
  "type": "module",
  "scripts": {
    "validate-config": "bun run src/config/validate-config.ts",
    "generate-types": "json-schema-to-typescript schemas/config-schema.json -o schemas/config-schema.ts",
    "test": "bun test",
    "build": "bun build"
  },
  "dependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "bun-types": "latest",
    "json-schema-to-typescript": "^13.1.1"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

### Project Initialization Workflow

**User starts new project:**

```bash
# Option 1: Use installer
curl -fsSL https://raw.githubusercontent.com/[user]/heritage-qc/main/install.sh | bash -s -- --local

# Option 2: Manual setup
mkdir my-project
cd my-project
git clone https://github.com/[user]/heritage-qc.git
mkdir images reports outputs logs
cp heritage-qc/templates/basic-spec.yaml project-spec.yaml
```

**Claude detects project structure:**

When user says: "Validate images in /path/to/project"

Claude checks:
1. Is heritage-qc/ directory present? (local install)
2. Is ~/.heritage-qc/ present? (global install)
3. Is /mnt/skills/user/heritage-qc/ present? (Claude install)

Then:
1. Finds or creates project-spec.yaml
2. Asks user for image directory path
3. Creates reports/, outputs/, logs/ if needed
4. Runs validation workflow
5. Saves all outputs to project directory

### Supported File Formats

**TIFF Files:**
- Extensions: `.tif`, `.tiff`
- Validation: Full JHOVE structure validation
- EXIF: Complete extraction
- Use case: Archival masters

**RAW Camera Files:**
- Extensions: `.dng`, `.arw`, `.nef`, `.cr2`, `.cr3`, `.orf`, `.raw`, `.raf`, `.rw2`
- Validation: EXIF extraction, basic structure checks (no JHOVE)
- EXIF: Complete extraction via ExifTool
- Use case: Original camera captures, DNG masters
- Note: JHOVE validation skipped for RAW (not supported by JHOVE)

**JPEG Files (Future):**
- Extensions: `.jpg`, `.jpeg`
- Validation: Basic structure, EXIF
- Use case: Access derivatives

**PNG Files (Future):**
- Extensions: `.png`
- Validation: Basic structure, limited EXIF
- Use case: Screen captures, graphics

### Configuration Examples

**TIFF-Only Project:**
```yaml
# templates/tiff-only-spec.yaml
project:
  name: "TIFF Master Files"
  
format:
  file_type: "TIFF"
  allowed_extensions: [".tif", ".tiff"]
  compression: "Uncompressed"
  
dimensions:
  min_long_edge: 8000
  
color:
  bit_depth: 16
  
validation:
  run_jhove: true  # Full TIFF validation
```

**RAW-Only Project:**
```yaml
# templates/raw-only-spec.yaml
project:
  name: "Camera RAW Files"
  
format:
  file_type: "RAW"
  allowed_extensions: [".dng", ".arw", ".nef"]
  raw_format: "DNG"  # Expected RAW format
  
dimensions:
  min_long_edge: 6000
  
color:
  bit_depth: 16
  
required_exif:
  - tag: "Make"
    expected_value: "Sony"
  - tag: "Model"
    expected_value: "ILCE-7RM4"
  - tag: "LensModel"
  
validation:
  run_jhove: false  # JHOVE doesn't support RAW
  check_raw_validity: true  # Basic RAW checks
```

**Mixed Format Project:**
```yaml
# Mixed TIFF masters + RAW originals
project:
  name: "Museum Collection - Mixed Formats"
  
format:
  file_type: "TIFF"  # Primary format
  allowed_extensions: [".tif", ".tiff", ".dng", ".arw"]
  
dimensions:
  min_long_edge: 8000  # For TIFF
  
color:
  bit_depth: 16
  
validation:
  run_jhove: true  # Only for TIFF files
  check_raw_validity: true  # For RAW files
  mixed_formats: true  # Allow different formats in same batch
```

### Version Control & Releases

**Versioning (Semantic Versioning):**
- v1.0.0 - Initial release (TIFF + RAW support)
- v1.1.0 - Enhanced reporting features
- v1.2.0 - JPEG/PNG support
- v2.0.0 - Breaking changes (if any)

**Release Process:**
1. Update CHANGELOG.md
2. Tag release: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. GitHub Actions creates release
5. Update documentation
6. Announce to community

**GitHub Release Artifacts:**
- Source code (automatic)
- Compiled binaries (if applicable)
- Documentation PDF
- Example projects

### Community & Support

**Documentation:**
- README.md with quick start
- Complete user guide in docs/
- Video tutorials (future)
- Example projects

**Support Channels:**
- GitHub Issues (bug reports)
- GitHub Discussions (questions)
- Email support (optional)

**Contributing:**
- CONTRIBUTING.md with guidelines
- Code of conduct
- Issue templates
- PR templates

**Governance:**
- Open source (MIT license)
- Community contributions welcome
- Maintainer review process

### Marketing & Outreach

**Target Communities:**
- Digital preservation (NDSA, AVPreserve)
- Museum technology (MCN)
- Archives (SAA)
- Cultural heritage imaging

**Announcement Channels:**
- GitHub repository
- Digital preservation forums
- Museum technology mailing lists
- Social media (Twitter, LinkedIn)
- Blog posts

**Value Propositions:**
- Free and open source
- Works with Claude AI
- Handles TIFF and RAW files
- Generates professional reports
- Supports iterative workflows
- Project-based organization

### Future Enhancements

**Planned Features:**
- JPEG/PNG support
- Color profile validation
- Batch comparison tools
- Web dashboard (optional)
- Cloud storage integration
- API for programmatic access

**Community Requests:**
- FADGI compliance checking
- Metamorfoze standard support
- Custom validation rules
- Automated fix application
- Email notifications

---

## Example User Workflows

### Workflow 1: New Project with TIFF Masters

```
User: "I need to validate 500 TIFF files from a museum digitization project. 
The images are on my external drive at /Volumes/Archive/Museum2025/masters/"

Claude:
Let me help you set up a validation project.

First, I'll create a project directory structure. Where would you like to 
create the project?

User: "In my Documents folder, call it museum-validation"

Claude:
[Creates ~/Documents/museum-validation/]
[Installs heritage-qc locally or uses global installation]
[Creates project structure: reports/, outputs/, logs/]

I've set up the project. Now I need to understand the client requirements.
Do you have a requirements document, or should I start with a template?

User: "Use the museum template but set minimum dimension to 7000 pixels"

Claude:
[Loads templates/museum-spec.yaml]
[Updates min_long_edge to 7000]
[Saves as project-spec.yaml]

I've created project-spec.yaml with these requirements:
- Format: 16-bit TIFF, uncompressed
- Minimum long edge: 7000 pixels
- Color space: Adobe RGB (1998)
- Required EXIF: Make, Model, DateTime, Artist

Ready to validate the images at /Volumes/Archive/Museum2025/masters/?

User: "Yes"

Claude:
[Scans directory]
Found 500 TIFF files in /Volumes/Archive/Museum2025/masters/

Estimated time:
- EXIF extraction: ~8 minutes
- JHOVE validation: ~40 minutes  
- Total: ~50 minutes

Proceed?

User: "Yes"

Claude:
[Runs validation with progress updates]

Progress: 100/500 (20%) - ETA 40 minutes
Progress: 250/500 (50%) - ETA 20 minutes
Progress: 500/500 (100%) - Complete!

✓ Validation complete!

Results:
- Total: 500 images
- Passed: 487 (97%)
- Failed: 13 (3%)

Failures:
- 8 images: Long edge < 7000px (requires re-scan)
- 5 images: Missing Artist tag (fixable)

I've generated:
- reports/validation_report_v1.html (interactive)
- reports/validation_report_v1.md (summary)
- outputs/failed_images_v1.csv
- outputs/fix_exif_v1.sh (for Artist tag)

Would you like me to generate the fix script for the EXIF issues?
```

### Workflow 2: RAW Files (DNG Masters)

```
User: "Validate my DNG files in /nas/project-x/raw-masters/"

Claude:
[Checks for project setup]

I don't see a heritage-qc project here. Should I:
1. Create new project in current directory
2. Create project elsewhere

User: "Create it here"

Claude:
[Sets up project structure]

Do you have client specifications, or should I use a template?

User: "They want DNG files from Sony A7R IV, minimum 6000px, 14-bit"

Claude:
[Generates custom config]

I've created project-spec.yaml:

```yaml
format:
  file_type: "RAW"
  allowed_extensions: [".dng"]
  raw_format: "DNG"
dimensions:
  min_long_edge: 6000
required_exif:
  - tag: "Make"
    expected_value: "Sony"
  - tag: "Model"
    expected_value: "ILCE-7RM4"
```

Note: JHOVE validation will be skipped (doesn't support RAW files).

Proceed with validation?

[Validation runs with RAW-specific checks]

✓ Complete! 1,240/1,247 passed (99%)
```

### Workflow 3: Mixed TIFF and RAW

```
User: "Validate both TIFF and DNG files in /archive/batch-2025-01/"

Claude:
[Scans directory]

Found:
- TIFF files: 523
- DNG files: 523

I'll apply format-appropriate validation:
- TIFF: JHOVE + EXIF checks
- DNG: EXIF + basic RAW checks

Ready to proceed?
```

### Workflow 4: Iterative Fixing

```
[After running fix script]

User: "I ran the fix script. Re-validate."

Claude:
[Re-runs validation on modified files]

Comparing v1 → v2:
- Fixed: 64 EXIF issues ✓
- Remaining: 89 dimension issues

Progress: 42% of failures resolved!

Updated reports in reports/validation_report_v2.html
```

### Workflow 5: Multi-Directory Project (RAW + TIFF)

```
User: "I need to validate a museum digitization project. I have:
- RAW camera files in /Volumes/Archive/Museum2025/raw/
- TIFF deliverables in /Volumes/Archive/Museum2025/deliverable/"

Claude:
I see you have multiple directories with different file types. I'll help 
you set up validation for each.

Let's start by creating a project directory to organize everything.

Where would you like to create the project?

User: "Create it in ~/Documents/museum-project/"

Claude:
[Creates project structure]

~/Documents/museum-project/
├── heritage-qc/          (skill)
├── raw/                  (for RAW validation)
└── deliverable/          (for TIFF validation)

Now, let's validate the RAW files first.

Do you have client requirements, or should I use a template?

User: "Use the museum template. RAW files should be DNG from Sony A7R IV."

Claude:
[Creates raw/raw-spec.yaml]

Created raw/raw-spec.yaml with:
- Format: RAW (DNG)
- Camera: Sony ILCE-7RM4
- Minimum dimension: 6000px

Now I'll scan /Volumes/Archive/Museum2025/raw/

[Scans directory]

Found in /Volumes/Archive/Museum2025/raw/:
  ✓ 523 DNG files (RAW format) - will validate
  ⚠ 12 JPG files (JPEG format) - will skip
  ⚠ 3 TIF files (TIFF format) - will skip

The non-DNG files will be skipped. They don't belong in the RAW directory.
Would you like to proceed with validating the 523 DNG files?

User: "Yes, those other files shouldn't be there. Proceed."

Claude:
[Runs RAW validation]

Progress: 261/523 (50%) - ETA 3 minutes
Progress: 523/523 (100%) - Complete!

✓ RAW validation complete!

Results saved to: raw/reports/validation_report_v1.html

Summary:
- Total: 523 DNG files
- Passed: 520 (99%)
- Failed: 3 (1%)

Failures:
- 3 images: Wrong camera model (found ILCE-7RM3)

Now let's validate the TIFF deliverables.

Do the TIFF files have different requirements than the RAW?

User: "Yes - TIFFs need to be 8000px minimum, 16-bit, with Artist tag."

Claude:
[Creates deliverable/deliverable-spec.yaml]

Created deliverable/deliverable-spec.yaml with:
- Format: TIFF (16-bit, uncompressed)
- Minimum dimension: 8000px (higher than RAW)
- Required EXIF: Make, Model, Artist

Scanning /Volumes/Archive/Museum2025/deliverable/

[Scans directory]

Found in /Volumes/Archive/Museum2025/deliverable/:
  ✓ 523 TIFF files - will validate
  ⚠ 46 DNG files (RAW format) - will skip

Warning: Found 46 DNG files in the deliverable directory. 
These appear to be RAW files mixed with TIFFs.

Proceed with validating only the 523 TIFF files?

User: "Those DNGs are backups, ignore them. Validate the TIFFs."

Claude:
[Runs TIFF validation]

Progress: EXIF extraction 261/523 (50%) - ETA 4 min
Progress: JHOVE validation 130/523 (25%) - ETA 35 min
Progress: Complete!

✓ TIFF validation complete!

Results saved to: deliverable/reports/validation_report_v1.html

Summary:
- Total: 523 TIFF files
- Passed: 518 (99%)
- Failed: 5 (1%)

Failures:
- 5 images: Missing Artist tag (fixable)

Project Validation Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RAW Originals:
  Location: /Volumes/Archive/Museum2025/raw/
  Results: 520/523 passed (99%)
  Report: raw/reports/validation_report_v1.html

TIFF Deliverables:
  Location: /Volumes/Archive/Museum2025/deliverable/
  Results: 518/523 passed (99%)
  Report: deliverable/reports/validation_report_v1.html

Overall: 1038/1046 files passed (99%)

Next Steps:
1. Fix 3 RAW files with wrong camera model
2. Add Artist tag to 5 TIFF files (I can generate fix script)

Would you like me to generate the fix script for the TIFF files?

User: "Yes please."

Claude:
[Generates deliverable/outputs/fix_exif_v1.sh]

Fix script created: deliverable/outputs/fix_exif_v1.sh

Review and run the script to add Artist tags, then tell me to 
re-validate the deliverable directory.
```

---

**Document Version:** 1.1  
**Last Updated:** 2025-01-19  
**Changes:** Added distribution section, RAW file support, project-based structure, workflow examples, schema validation, multi-directory handling  
**Maintained By:** Project architect  
**Next Review:** After Phase 1 completion
