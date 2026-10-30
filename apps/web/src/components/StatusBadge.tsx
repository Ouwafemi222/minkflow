import { STATUS_LABELS, statusTone } from '@/lib/labels';

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusTone(status)}`}>{STATUS_LABELS[status] ?? status}</span>;
}
