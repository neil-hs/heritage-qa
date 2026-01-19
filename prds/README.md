# Implementation PRDs

PRDs organized by phase for AI agent implementation.

## Dependency Graph

```
Phase 1 (Foundation)
├── 1.1 Project Setup ─────────────────┐
├── 1.2 Database Schema ───────────────┼─→ All subsequent phases
├── 1.3 TypeScript Types ──────────────┤
└── 1.4 Progress Tracker ──────────────┘

Phase 2 (Config) ──────────────────────→ Phase 3-5 (need config)
├── 2.1 YAML Parser
├── 2.2 Schema Validator
└── 2.3 Config Templates

Phase 3 (EXIF) ────────────────────────→ Phase 5 (needs EXIF data)
├── 3.1 ExifTool Wrapper
├── 3.2 File Scanner
└── 3.3 Batch Processor

Phase 4 (Format Validation) ───────────→ Phase 5 (needs validation results)
├── 4.1 JHOVE Wrapper (TIFF)
└── 4.2 RAW Validator

Phase 5 (Spec Validation) ─────────────→ Phase 6-7 (needs validation results)
├── 5.1 Dimension Validator
├── 5.2 Color Validator
├── 5.3 EXIF Tag Validator
└── 5.4 Spec Validator (orchestrator)

Phase 6 (Reporting) ───────────────────→ Phase 9 (integration)
├── 6.1 HTML Report
├── 6.2 Markdown Summary
└── 6.3 CSV Export

Phase 7 (Fixes) ───────────────────────→ Phase 9
└── 7.1 Fix Script Generator

Phase 8 (Utilities) - Can run parallel
├── 8.1 System File Cleanup
├── 8.2 Filename Validator
└── 8.3 Validation Comparison

Phase 9 (Integration)
├── 9.1 SKILL.md
└── 9.2 E2E Tests
```

## Implementation Order

**Batch 1** (Foundational - do first)
- 1.1 → 1.2 → 1.3 → 1.4 (sequential)

**Batch 2** (Config - after foundation)
- 2.1 → 2.2 → 2.3 (sequential)

**Batch 3** (Extraction - after config, can parallel with Batch 4)
- 3.1 → 3.2 → 3.3 (sequential)

**Batch 4** (Format validation - after config, can parallel with Batch 3)
- 4.1, 4.2 (parallel)

**Batch 5** (Spec validation - after Batch 3 & 4)
- 5.1, 5.2, 5.3 (parallel) → 5.4

**Batch 6** (Outputs - after Batch 5, all parallel)
- 6.1, 6.2, 6.3, 7.1, 8.1, 8.2, 8.3

**Batch 7** (Integration - last)
- 9.1, 9.2

## Agent Assignment

Each PRD designed for single AI agent session (~1-2 hours work).
Total: 19 PRDs across 9 phases.
