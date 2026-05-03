export default function EventDetailsForm({ value, onChange, onSubmit, submitLabel = 'Save and continue' }) {
  const handleChange = (event) => {
    const { name, value: fieldValue } = event.target;
    onChange?.({
      ...value,
      [name]: fieldValue,
    });
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Event name</span>
          <input name="eventName" value={value.eventName} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Q3 team luncheon" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Organizer name</span>
          <input name="organizerName" value={value.organizerName} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Jordan Lee" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input name="organizerEmail" type="email" value={value.organizerEmail} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="jordan@company.com" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Phone</span>
          <input name="organizerPhone" value={value.organizerPhone} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="(555) 123-4567" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Event date</span>
          <input name="eventDate" type="date" value={value.eventDate} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Event time</span>
          <input name="eventTime" type="time" value={value.eventTime} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Guest count</span>
          <input name="guestCount" type="number" min="1" value={value.guestCount} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="45" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Venue name</span>
          <input name="venueName" value={value.venueName} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Office lobby" />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Venue address</span>
        <input name="venueAddress" value={value.venueAddress} onChange={handleChange} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="123 Market St, San Francisco, CA" />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          value={value.notes}
          onChange={handleChange}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          placeholder="Gate code, dietary notes, loading dock instructions, etc."
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
