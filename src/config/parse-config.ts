import { parse } from 'yaml';
import type { ProjectSpec, ParseResult, ParseError } from '../types/config';

/**
 * Parses a YAML configuration string into a ProjectSpec object.
 */
export function parseConfigString(yamlContent: string): ParseResult {
  if (!yamlContent || yamlContent.trim() === '') {
    return {
      success: false,
      errors: [{ message: 'Configuration file is empty' }],
    };
  }

  try {
    // Strip $schema reference before parsing to avoid it being treated as a property
    // if it's not in our ProjectSpec type, although yaml.parse handles it fine.
    // We strip it primarily if it's at the top level and we want a clean object.
    const strippedYaml = yamlContent.replace(/^\$schema:.*$/m, '');
    
    const config = parse(strippedYaml) as ProjectSpec;

    if (typeof config !== 'object' || config === null) {
      return {
        success: false,
        errors: [{ message: 'Configuration must be a YAML object' }],
      };
    }

    return {
      success: true,
      config,
      errors: [],
    };
  } catch (error: any) {
    const parseError: ParseError = {
      message: error.message || 'Unknown YAML parsing error',
    };

    if (error.linePos) {
      parseError.line = error.linePos[0]?.line;
      parseError.column = error.linePos[0]?.col;
    }

    return {
      success: false,
      errors: [parseError],
    };
  }
}

/**
 * Reads and parses a YAML configuration file from disk.
 */
export async function parseConfig(configPath: string): Promise<ParseResult> {
  try {
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      return {
        success: false,
        errors: [{ message: `Configuration file not found: ${configPath}` }],
      };
    }

    const content = await file.text();
    return parseConfigString(content);
  } catch (error: any) {
    return {
      success: false,
      errors: [{ message: `Error reading configuration file: ${error.message}` }],
    };
  }
}
