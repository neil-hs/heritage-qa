import { parseConfig } from './parse-config';
import type { ProjectSpec } from '../types/config';
import { join, resolve } from 'path';

export type TemplateName = 'basic' | 'museum' | 'archive' | 'tiff-only' | 'raw-only';

const TEMPLATES: Record<TemplateName, string> = {
  'basic': 'templates/basic-spec.yaml',
  'museum': 'templates/museum-spec.yaml',
  'archive': 'templates/archive-spec.yaml',
  'tiff-only': 'templates/tiff-only-spec.yaml',
  'raw-only': 'templates/raw-only-spec.yaml',
};

// Helper to resolve paths relative to this module
function resolvePath(relativePath: string): string {
  return resolve(import.meta.dir, '../..', relativePath);
}

/**
 * Lists available template names.
 */
export function listTemplates(): TemplateName[] {
  return Object.keys(TEMPLATES) as TemplateName[];
}

/**
 * Gets the absolute path to a template file.
 */
export function getTemplatePath(name: TemplateName): string {
  return resolvePath(TEMPLATES[name]);
}

/**
 * Loads and parses a template.
 */
export async function loadTemplate(name: TemplateName): Promise<ProjectSpec> {
  const path = getTemplatePath(name);
  const result = await parseConfig(path);
  if (!result.success || !result.config) {
    throw new Error(`Failed to load template "${name}": ${result.errors[0]?.message}`);
  }
  return result.config;
}

/**
 * Copies a template file to a destination path.
 */
export async function copyTemplate(name: TemplateName, destPath: string): Promise<void> {
  const srcPath = getTemplatePath(name);
  const srcFile = Bun.file(srcPath);
  
  if (!(await srcFile.exists())) {
    throw new Error(`Template file not found: ${srcPath}`);
  }

  const content = await srcFile.text();
  await Bun.write(destPath, content);
}
