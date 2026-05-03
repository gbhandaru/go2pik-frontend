const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  submitted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  awaiting_payment: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  payment_pending: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function RequestStatusBadge({ status = 'draft' }) {
  const normalized = String(status || 'draft')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  const label = normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const classes = STATUS_STYLES[normalized] || STATUS_STYLES.draft;

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${classes}`}>
      {label}
    </span>
  );
}
