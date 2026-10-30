import type { LlmProvider, TtsProvider } from '@minkflow/ai';
import type { ProjectStatus, RenderManifest } from '@minkflow/contracts';
import type { Db, JobRow } from '@minkflow/db';
import type { QcExpectations, QcReport } from '@minkflow/render/node';
import type { Logger } from '@minkflow/shared';
import type { ObjectStorage } from '@minkflow/storage';

export interface PipelineConfig {
  workerId: string;
  leaseSeconds: number;
  /** Daily provider spend caps (USD, estimated). Jobs pause with SPEND_CAP_REACHED when exceeded. */
  platformDailyCapUsd: number;
  workspaceDailyCapUsd: number;
  renderConcurrency: number | null;
  tempDir: string;
  narrationRetentionDays: number;
  renderRetentionDays: number;
  previewRetentionDays: number;
}

/** Rendering is injected so tests can exercise the pipeline without Chromium. */
export interface Renderer {
  render(manifest: RenderManifest, options: { outputPath: string; scale: number; onProgress: (f: number) => void; isCanceled: () => boolean }): Promise<void>;
  qc(absPath: string, expectations: QcExpectations): Promise<QcReport>;
  probeDurationMs(absPath: string): Promise<number>;
}

export interface PipelineDeps {
  db: Db;
  storage: ObjectStorage;
  llm: LlmProvider;
  tts: TtsProvider;
  renderer: Renderer;
  logger: Logger;
  config: PipelineConfig;
}

export interface JobContext {
  job: JobRow;
  deps: PipelineDeps;
  log: Logger;
  /** Records progress (sent with the next heartbeat). Synchronous so it can be called from render callbacks. */
  setProgress(fraction: number, stage?: string): void;
  /** Throws JobCanceledSignal if the user canceled or the lease was lost. Call between expensive steps. */
  checkpoint(): Promise<void>;
  isCanceled(): boolean;
  /** Microcredits consumed so far (used when a job is canceled mid-way). */
  charged: number;
}

export interface ProcessorResult {
  result: Record<string, unknown>;
  /** Microcredits to charge; capped at the reservation by the runner. */
  chargedMicro: number;
  /** Overrides the default success status from JOB_PROJECT_STAGES (null = leave unchanged). */
  nextStatus?: ProjectStatus | null;
}

export type Processor = (ctx: JobContext) => Promise<ProcessorResult>;

export class JobCanceledSignal extends Error {
  constructor(readonly reason: 'canceled' | 'lost') {
    super(`Job ${reason}`);
  }
}
