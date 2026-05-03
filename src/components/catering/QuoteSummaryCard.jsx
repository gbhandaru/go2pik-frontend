import { formatCurrency } from '../../utils/formatCurrency.js';

export default function QuoteSummaryCard({
  quote,
  title = 'Estimated quote',
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  note,
}) {
  if (!quote) {
    return null;
  }

  return (
    <aside className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Pricing</p>
          <h3 className="mt-1 text-lg font-semibold">{title}</h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          {quote.guestCount} guests
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <dt>Subtotal</dt>
          <dd className="font-medium text-white">{formatCurrency(quote.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Service fee</dt>
          <dd className="font-medium text-white">{formatCurrency(quote.serviceFee)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Tax</dt>
          <dd className="font-medium text-white">{formatCurrency(quote.tax)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base">
          <dt>Total</dt>
          <dd className="font-semibold text-emerald-300">{formatCurrency(quote.total)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-6 text-slate-300">{note || quote.note}</p>

      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {primaryActionLabel ? (
            <button type="button" className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </button>
          ) : null}
          {secondaryActionLabel ? (
            <button type="button" className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      )}
    </aside>
  );
}
