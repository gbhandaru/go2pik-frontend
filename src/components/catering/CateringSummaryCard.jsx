import { formatCurrency } from '../../utils/formatCurrency.js';

export default function CateringSummaryCard({ eventDetails = {}, items = [], compact = false }) {
  const guestCount = Number(eventDetails.guestCount) || 0;

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Summary</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{eventDetails.eventName || 'Catering request'}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-4">
          <dt>Organizer</dt>
          <dd className="font-medium text-slate-900">{eventDetails.organizerName || 'Not set'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Guest count</dt>
          <dd className="font-medium text-slate-900">{guestCount || 'Not set'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Event date</dt>
          <dd className="font-medium text-slate-900">{eventDetails.eventDate || 'Not set'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Venue</dt>
          <dd className="font-medium text-slate-900">{eventDetails.venueName || 'Not set'}</dd>
        </div>
      </dl>

      {!compact ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Items preview</p>
          <ul className="mt-2 space-y-2">
            {items.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4">
                <span>{item.name}</span>
                <span className="font-semibold text-slate-900">{item.quantity}x</span>
              </li>
            ))}
            {items.length > 4 ? <li className="text-slate-500">+ {items.length - 4} more</li> : null}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
