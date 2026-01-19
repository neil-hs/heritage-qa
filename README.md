# Heritage QC

**Heritage Digitization Quality Control - Image Validation Skill**

Heritage QC is a professional image validation tool designed for heritage digitization workflows. It validates image deliverables against client specifications, generates actionable reports, and ensures quality before delivery.

## 🎯 Mission

To create a robust tool that validates heritage digitization images against client specifications, provides actionable feedback, and supports iterative quality improvement workflows.

## ✨ Key Features

- **Flexible Configuration**: Parse natural language client requirements into structured YAML configurations.
- **Multi-Format Support**:
  - **TIFF**: Full structural validation via JHOVE and metadata checks.
  - **RAW**: Support for camera raw formats (DNG, ARW, NEF, CR2, etc.).
- **Metadata Validation**: Extract and validate EXIF/IPTC/XMP metadata from batches of 100-10,000+ images.
- **Actionable Reporting**:
  - Interactive HTML reports.
  - Markdown summaries.
  - CSV exports of failed images.
- **Fix Automation**: Generate shell scripts to automatically fix correctable metadata issues.
- **Privacy First**: Runs locally on your filesystem with no network dependencies.

## 🛠️ System Requirements

- **Runtime**: [Bun](https://bun.sh/) (TypeScript/JavaScript)
- **Database**: SQLite (built-in to Bun)
- **External Tools**:
  - [ExifTool](https://exiftool.org/) (CLI) - **Required** for metadata extraction.
  - [JHOVE](https://jhove.openpreservation.org/) (CLI) - **Recommended** for TIFF structure validation.

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/hs-studios/heritage-qc.git
cd heritage-qc

# Install dependencies
bun install
```

### Basic Usage Workflow

1. **Prepare your project**
   Create a directory for your digitization project and add an `images/` folder containing your assets.

2. **Define Specifications**
   Create a `project-spec.yaml` file defining your requirements (dimensions, bit depth, required tags).

   ```yaml
   project:
     name: "Museum Archive 2025"
   format:
     file_type: "TIFF"
   dimensions:
     min_long_edge: 6000
   validation:
     run_jhove: true
   ```

3. **Run Validation**
   *(CLI entry points are currently under development)*

## 📂 Repository Structure

```text
heritage-qc/
├── src/                 # Source code
│   ├── config/          # Configuration parsing & validation
│   ├── extraction/      # EXIF & file info extraction
│   ├── validation/      # JHOVE & spec validation logic
│   └── reporting/       # Report generators
├── schemas/             # JSON Schemas & TypeScript types
├── templates/           # Configuration templates (Basic, Museum, Archive)
├── tests/               # Unit and integration tests
└── plan/                # Planning documentation
```

## 📅 Development Roadmap

**Current Status: Phase 1 (Foundation)**

- [x] Planning & Architecture
- [ ] **Phase 1**: Foundation & Data Layer (Database, Types)
- [ ] **Phase 2**: Configuration System (YAML Parser, Schema Validation)
- [ ] **Phase 3**: EXIF Extraction (ExifTool Wrapper)
- [ ] **Phase 4**: Format-Specific Validation (JHOVE Integration)
- [ ] **Phase 5**: Specification Validation Logic
- [ ] **Phase 6**: Reporting & Fix Scripts

## 📄 License

MIT