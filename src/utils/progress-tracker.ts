import { writeFileSync, renameSync } from 'fs';

export interface ProgressState {
  operation: string;
  phase: string;
  total: number;
  completed: number;
  failed: number;
  currentFile?: string;
  startedAt: string;
  updatedAt: string;
  estimatedCompletion?: string;
  errors: ProgressError[];
}

export interface ProgressError {
  file: string;
  error: string;
  timestamp: string;
}

export class ProgressTracker {
  private state: ProgressState;
  private outputPath: string;
  private lastUpdate: number = 0;
  private updateInterval: number = 500;

  constructor(outputPath: string, operation: string) {
    this.outputPath = outputPath;
    this.state = {
      operation,
      phase: 'init',
      total: 0,
      completed: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errors: []
    };
  }

  start(total: number, phase: string = 'processing'): void {
    this.state.total = total;
    this.state.phase = phase;
    this.state.startedAt = new Date().toISOString();
    this.writeState();
  }

  update(completed: number, currentFile?: string): void {
    this.state.completed = completed;
    this.state.currentFile = currentFile;
    this.state.updatedAt = new Date().toISOString();
    
    // Calculate ETA
    const now = Date.now();
    if (this.state.completed > 0) {
        const elapsed = now - new Date(this.state.startedAt).getTime();
        const rate = this.state.completed / elapsed;
        const remaining = this.state.total - this.state.completed;
        const eta = remaining / rate;
        this.state.estimatedCompletion = new Date(now + eta).toISOString();
    }

    this.throttledWrite();
  }

  increment(currentFile?: string): void {
    this.update(this.state.completed + 1, currentFile);
  }

  fail(file: string, error: string): void {
    this.state.failed++;
    this.state.errors.push({
      file,
      error,
      timestamp: new Date().toISOString()
    });
    this.writeState(); // Write immediately on error
  }

  complete(): void {
    this.state.phase = 'completed';
    this.state.updatedAt = new Date().toISOString();
    this.state.estimatedCompletion = undefined;
    this.writeState();
  }

  getState(): ProgressState {
    return { ...this.state };
  }

  getPercentage(): number {
    return this.state.total > 0 ? (this.state.completed / this.state.total) * 100 : 0;
  }

  getETA(): Date | null {
    return this.state.estimatedCompletion ? new Date(this.state.estimatedCompletion) : null;
  }
  
  saveCheckpoint(): void {
      this.writeState();
  }

  private throttledWrite(): void {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval) {
      this.writeState();
      this.lastUpdate = now;
    }
  }

  private writeState(): void {
    const tempPath = `${this.outputPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
    renameSync(tempPath, this.outputPath);
  }
}

export function setupGracefulShutdown(
  progress: ProgressTracker,
  cleanupCallback?: () => Promise<void>
): void {
  const cleanup = async () => {
    console.log('\nInterrupted - saving progress...');
    progress.saveCheckpoint();
    
    if (cleanupCallback) {
      await cleanupCallback();
    }

    console.log('Progress saved.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
