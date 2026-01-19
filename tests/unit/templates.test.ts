import { expect, test, describe } from "bun:test";
import { listTemplates, loadTemplate, getTemplatePath } from "../../src/config/templates";

describe("Template Loader", () => {
  test("should list available templates", () => {
    const templates = listTemplates();
    expect(templates).toContain("basic");
    expect(templates).toContain("museum");
    expect(templates).toContain("raw-only");
  });

  test("should get template path", () => {
    const path = getTemplatePath("basic");
    expect(path.endsWith("templates/basic-spec.yaml")).toBe(true);
  });

  test("should load a template", async () => {
    const config = await loadTemplate("museum");
    expect(config.project.name).toBe("Museum Digitization Project");
    expect(config.format.file_type).toBe("TIFF");
  });

  test("should throw error for invalid template", async () => {
    // @ts-ignore
    expect(async () => await loadTemplate("non-existent")).toThrow();
  });
});
