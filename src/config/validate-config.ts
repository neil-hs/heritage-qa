import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseConfig } from './parse-config';
import type { 
  ProjectSpec, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning 
} from '../types/config';
import { resolve, join } from 'path';

const ajv = new Ajv({ allErrors: true, verbose: true, useDefaults: true });
addFormats(ajv);

let cachedValidate: any = null;

// Helper to resolve paths relative to this module
function resolvePath(relativePath: string): string {
  return resolve(import.meta.dir, '../..', relativePath);
}

/**
 * Validates a ProjectSpec object against the JSON schema and semantic rules.
 */
export async function validateConfig(config: unknown): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Schema Validation
  if (!cachedValidate) {
    const schemaPath = resolvePath('schemas/config-schema.json');
    const schema = await Bun.file(schemaPath).json();
    cachedValidate = ajv.compile(schema);
  }
  
  const valid = cachedValidate(config);
  
  if (!valid && cachedValidate.errors) {
    for (const error of cachedValidate.errors) {
      errors.push({
        path: error.instancePath || 'root',
        message: error.message || 'Unknown schema error',
        value: error.data
      });
    }
    return { valid: false, errors, warnings };
  }

  const spec = config as ProjectSpec;

  // 2. Semantic Validation
  
  // RAW + run_jhove=true → warning
  if (spec.format.file_type === 'RAW' && spec.validation.run_jhove) {
    warnings.push({
      path: 'validation.run_jhove',
      message: "JHOVE doesn't support RAW files",
      suggestion: "Set run_jhove: false for RAW projects"
    });
  }

  // min > max dimensions → error
  if (spec.dimensions) {
    const { min_long_edge, max_long_edge, min_short_edge, max_short_edge } = spec.dimensions;
    if (min_long_edge && max_long_edge && min_long_edge > max_long_edge) {
      errors.push({
        path: 'dimensions.min_long_edge',
        message: `Minimum long edge (${min_long_edge}) cannot be greater than maximum long edge (${max_long_edge})`
      });
    }
    if (min_short_edge && max_short_edge && min_short_edge > max_short_edge) {
      errors.push({
        path: 'dimensions.min_short_edge',
        message: `Minimum short edge (${min_short_edge}) cannot be greater than maximum short edge (${max_short_edge})`
      });
    }
    
    // Unrealistic dimensions (>20000px)
    if (min_long_edge && min_long_edge > 20000) {
      warnings.push({
        path: 'dimensions.min_long_edge',
        message: "Very large dimension (>20,000px)",
        suggestion: "Ensure this is correct for your project"
      });
    }
  }

  // Unknown EXIF tags → warning
  if (spec.required_exif && spec.required_exif.length > 0) {
    const exifReferencePath = resolvePath('schemas/exif-tags-reference.json');
    const exifTagsReference: string[] = await Bun.file(exifReferencePath).json();
    for (const req of spec.required_exif) {
      if (!exifTagsReference.includes(req.tag)) {
        const suggestion = findClosestMatch(req.tag, exifTagsReference);
        warnings.push({
          path: `required_exif[tag=${req.tag}]`,
          message: `"${req.tag}" is not in the standard EXIF tag reference`,
          suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a configuration file from disk.
 */
export async function validateConfigFile(path: string): Promise<ValidationResult> {
  const parseResult = await parseConfig(path);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.errors.map(e => ({ path: 'yaml', message: e.message })),
      warnings: []
    };
  }
  return validateConfig(parseResult.config);
}

/**
 * Simple Levenshtein distance based closest match finder.
 */
function findClosestMatch(target: string, choices: string[]): string | null {
  let minDistance = Infinity;
  let closest = null;

  for (const choice of choices) {
    const distance = levenshteinDistance(target.toLowerCase(), choice.toLowerCase());
    if (distance < minDistance && distance <= 3) { // Threshold of 3
      minDistance = distance;
      closest = choice;
    }
  }

  return closest;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => 
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

// CLI Support
if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: bun run validate-config <project-spec.yaml>");
    process.exit(1);
  }

  const configPath = args[0];
  const result = await validateConfigFile(configPath);

  if (result.valid) {
    console.log("✅ Configuration is valid!");
  } else {
    console.error("❌ Configuration has errors:");
    for (const err of result.errors) {
      console.error(`  [${err.path}] ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  Warnings:");
    for (const warn of result.warnings) {
      console.warn(`  [${warn.path}] ${warn.message}`);
      if (warn.suggestion) {
        console.warn(`    💡 ${warn.suggestion}`);
      }
    }
  }

  process.exit(result.valid ? 0 : 1);
}
