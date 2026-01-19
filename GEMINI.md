# Heritage QC

## Project Overview
Heritage QC is a professional image validation tool for heritage digitization workflows, designed to validate TIFF and RAW images against client specifications. It creates detailed reports and fix scripts to ensure deliverable quality.

- **Status:** Planning complete, implementation phase.
- **Goal:** Create a local CLI tool using Bun and SQLite.

## Architecture
- **Language:** TypeScript (Bun runtime).
- **Data Store:** SQLite (local `validation.db` in the user's project folder).
- **Core Tools:** Wraps `exiftool` and `jhove` for file analysis.
- **Config:** YAML-based project specifications (`project-spec.yaml`) validated with JSON Schema.

## Directory Structure
- `plan/`: Architectural documentation and roadmap.
- `prds/`: Detailed Product Requirement Documents. **Start here for implementation tasks.**
- `src/`: Source code (To be created).
- `schemas/`: JSON and SQL schemas (To be created).
- `templates/`: Configuration templates (To be created).
- `tests/`: Unit and integration tests (To be created).

## Development Workflow
1.  **Read PRDs:** Implementation is rigidly guided by documents in `prds/` (e.g., `1.1-project-setup.md`).
2.  **Runtime:** Use `bun` for package management, script execution, and testing.
3.  **Commands (Planned):**
    - `bun install`: Install dependencies.
    - `bun test`: Run test suite.
    - `bun run validate-config`: Run configuration validation script.
4.  **Conventions:**
    - **Type Safety:** Strict TypeScript. No `any` without strong justification.
    - **Validation:** Use `ajv` for JSON Schema validation of configurations.
    - **Independence:** The tool should run locally without network dependencies.
    - **Project Isolation:** All outputs (DB, reports) are saved to the user's specific project directory.

## Current State & Immediate Actions
The project is currently in the setup phase.
- **Primary Reference:** `prds/1.1-project-setup.md`.
- **Action:** Initialize the Bun project, set up directory structure, and configure TypeScript.
