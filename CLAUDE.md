# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heritage QC is an image validation tool for heritage digitization workflows. It validates image deliverables (TIFF, RAW) against client specifications, generates reports, and produces fix scripts.

**Status:** Early stage - planning complete, implementation not started.

## Tech Stack

- **Runtime:** Bun (TypeScript)
- **Database:** SQLite (Bun's built-in driver)
- **Config:** YAML with JSON Schema validation
- **External CLIs:** ExifTool (metadata), JHOVE (TIFF validation)

## Commands (Planned)

```bash
bun install              # Install dependencies
bun test                 # Run tests
bun run validate-config  # Validate project-spec.yaml
bun run generate-types   # Generate TS types from JSON Schema
bun build                # Build project
```

## Architecture

```
Configuration Layer → Execution Layer → Data Layer → Reporting Layer
      ↓                    ↓                ↓              ↓
  YAML parsing        ExifTool/JHOVE    SQLite DB    HTML/MD/CSV
  Schema validation   Spec validation   Progress     Fix scripts
  Templates           Batch processing  Audit trail
```

**Data Flow:**
1. Parse client requirements → generate project-spec.yaml
2. Validate config against JSON Schema
3. Scan directory for TIFF/RAW files
4. Extract EXIF via ExifTool, validate TIFF structure via JHOVE
5. Check against spec (dimensions, bit depth, color space, required tags)
6. Generate versioned reports (v1, v2, etc.) and fix scripts
7. Store all results in SQLite for audit trail

## Planned Structure

```
src/
├── config/      # YAML parsing, schema validation, templates
├── extraction/  # ExifTool wrapper, file info extraction
├── validation/  # JHOVE wrapper, spec validation, filename checks
├── reporting/   # HTML, Markdown, CSV generators
├── fixes/       # Fix script generation
├── cleanup/     # System file removal (.DS_Store, etc.)
└── utils/       # Progress tracking, DB helpers
schemas/         # JSON Schema, database.sql, generated TS types
templates/       # YAML config templates (museum, archive, basic)
tests/           # Unit and integration tests with fixtures
```

## Key Design Decisions

- **Project-based isolation:** All outputs stay in user-specified project directory
- **SQLite for portability:** No external DB required, data travels with project
- **Batch processing:** 100-image chunks with resume capability
- **Versioned validation:** Multiple runs produce v1, v2, v3 reports
- **JHOVE for TIFF only:** RAW files get basic validity checks, no structural validation
- **ExifTool unified approach:** Single tool handles all format metadata extraction

## Supported Formats

- **TIFF:** Full JHOVE structural validation + EXIF
- **RAW:** DNG, ARW, NEF, CR2, CR3, ORF, RAF, RW2 - EXIF only, basic checks
- **JPEG/PNG:** Planned for access derivatives

## Configuration Schema

Specs defined in `project-spec.yaml`:
- `project`: name, client, description
- `format`: file_type, extensions, compression
- `dimensions`: min/max long/short edge, exact mode
- `color`: bit_depth (8/16/32), color_space, ICC profile
- `required_exif`: tag name + optional expected value
- `validation`: run_jhove, check_raw_validity, mixed_formats
- `naming`: regex pattern, allow_spaces, required_prefix

## Implementation Phases

1. **Foundation:** DB schema, TypeScript types, progress tracking
2. **Config System:** YAML parser, schema validator, templates
3. **EXIF Extraction:** ExifTool wrapper, batch processing
4. **Format Validation:** JHOVE wrapper (TIFF), RAW basic checks
5. **Spec Validation:** Dimensions, bit depth, EXIF tag checking
6. **Reporting:** HTML reports, Markdown summaries, CSV exports, fix scripts
