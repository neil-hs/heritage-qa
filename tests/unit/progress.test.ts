import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ProgressTracker } from "../../src/utils/progress-tracker";
import { existsSync, readFileSync, unlinkSync } from "fs";

const TEST_PROGRESS = "test-progress.json";

describe("ProgressTracker", () => {
  beforeEach(() => {
    if (existsSync(TEST_PROGRESS)) unlinkSync(TEST_PROGRESS);
  });

  afterEach(() => {
    if (existsSync(TEST_PROGRESS)) unlinkSync(TEST_PROGRESS);
  });

  it("should initialize and start", () => {
    const progress = new ProgressTracker(TEST_PROGRESS, "test-op");
    progress.start(100);
    
    expect(progress.getState().total).toBe(100);
    expect(progress.getState().phase).toBe("processing");
    // Check file created
    expect(existsSync(TEST_PROGRESS)).toBe(true);
  });

  it("should update progress", () => {
    const progress = new ProgressTracker(TEST_PROGRESS, "test-op");
    progress.start(100);
    progress.update(50);
    
    expect(progress.getPercentage()).toBe(50);
    expect(progress.getState().completed).toBe(50);
  });

  it("should mark completion", () => {
    const progress = new ProgressTracker(TEST_PROGRESS, "test-op");
    progress.start(100);
    progress.complete();
    
    expect(progress.getState().phase).toBe("completed");
  });
});
