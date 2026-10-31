import type { JobStatus, JobType, ProjectStatus } from '@minkflow/contracts';

export interface WorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  plan: 'free' | 'starter' | 'creator' | 'pro';
  suspended_at: Date | null;
  created_at: Date;
}

export type AvatarMode = 'auto' | 'upload' | 'none';

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_mode: AvatarMode;
  avatar_asset_id: string | null;
  deletion_requested_at: Date | null;
  deletion_reason: string | null;
  deletion_note: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Client-readable columns only; the refresh token never leaves the server-side repository functions. */
export interface YoutubeConnectionRow {
  workspace_id: string;
  channel_id: string;
  channel_title: string;
  channel_thumbnail_url: string | null;
  scopes: string[];
  connected_at: Date;
  updated_at: Date;
}

export interface ProjectRow {
  id: string;
  workspace_id: string;
  title: string;
  status: ProjectStatus;
  current_revision_id: string | null;
  version: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RevisionRow {
  id: string;
  project_id: string;
  version: number;
  input_json: unknown;
  script_json: unknown;
  storyboard_json: unknown;
  brand_json: unknown;
  author_id: string | null;
  created_at: Date;
}

export interface JobRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  revision_id: string | null;
  type: JobType;
  status: JobStatus;
  stage: string | null;
  progress: number;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
  input_json: Record<string, unknown>;
  result_json: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  cancel_requested: boolean;
  reserved_credits: number;
  locked_by: string | null;
  locked_until: Date | null;
  run_after: Date;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

export type AssetKind = 'narration' | 'upload' | 'logo' | 'preview' | 'render';

export interface AssetRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  kind: AssetKind;
  storage_key: string;
  mime: string;
  size: number;
  sha256: string;
  cache_key: string | null;
  duration_ms: number | null;
  meta_json: Record<string, unknown>;
  provenance_json: Record<string, unknown>;
  license_json: Record<string, unknown>;
  expires_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
}

export interface LedgerRow {
  id: string;
  workspace_id: string;
  amount: number;
  kind: 'grant' | 'purchase' | 'reserve' | 'release' | 'refund' | 'adjustment';
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  created_at: Date;
}

export interface UsageRow {
  id: string;
  workspace_id: string;
  job_id: string | null;
  provider: string;
  model: string | null;
  operation: string;
  quantity: number;
  unit: string;
  estimated_usd: number;
  actual_usd: number | null;
  cached: boolean;
  provider_request_id: string | null;
  created_at: Date;
}

export interface PaymentRow {
  id: string;
  workspace_id: string;
  provider: 'paystack';
  reference: string;
  external_id: string | null;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  amount_minor: number;
  currency: string;
  credits: number;
  pack_id: string;
  verified_at: Date | null;
  created_at: Date;
}
