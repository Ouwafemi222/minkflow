'use client';

import { ApiError } from '@/lib/client';

/** Downloads a finished preview/render through the authenticated API (no signed-URL hop). */
export async function downloadJobVideo(jobId: string, filename: string): Promise<void> {
  const res = await fetch(`/api/jobs/${jobId}/download`, { cache: 'no-store' });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string; requestId?: string; retryable?: boolean } } | null;
    throw new ApiError(res.status, {
      code: json?.error?.code ?? 'INTERNAL',
      message: json?.error?.message ?? 'Download failed.',
      requestId: json?.error?.requestId ?? 'n/a',
      retryable: json?.error?.retryable ?? true,
    });
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
