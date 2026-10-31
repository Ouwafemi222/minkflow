export const DELETION_REASON_IDS = ['not_using', 'missing_features', 'too_expensive', 'switching', 'privacy', 'mistake', 'other'] as const;

export type DeletionReasonId = (typeof DELETION_REASON_IDS)[number];

export const DELETION_REASONS: ReadonlyArray<{ id: DeletionReasonId; label: string }> = [
  { id: 'not_using', label: 'I am not using Minkflow enough' },
  { id: 'missing_features', label: 'It is missing features I need' },
  { id: 'too_expensive', label: 'Credits or pricing do not work for me' },
  { id: 'switching', label: 'I am switching to another tool' },
  { id: 'privacy', label: 'Privacy or data concerns' },
  { id: 'mistake', label: 'I created this account by mistake' },
  { id: 'other', label: 'Other' },
];

export function deletionReasonLabel(id: string | null | undefined, note?: string | null): string {
  const row = DELETION_REASONS.find((r) => r.id === id);
  if (!row) return note?.trim() || '—';
  if (row.id === 'other' && note?.trim()) return `Other: ${note.trim()}`;
  return row.label;
}
