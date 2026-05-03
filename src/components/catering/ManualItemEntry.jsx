import { useState } from 'react';

export default function ManualItemEntry({ onAddItem }) {
  const [form, setForm] = useState({
    name: '',
    quantity: '1',
    notes: '',
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    onAddItem?.({
      name: form.name.trim(),
      quantity: Number(form.quantity) || 1,
      notes: form.notes.trim(),
    });

    setForm({
      name: '',
      quantity: '1',
      notes: '',
    });
  };

  return (
    <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Manual entry</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Add items yourself</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_140px]">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Chicken sliders"
          />
          <input
            value={form.quantity}
            type="number"
            min="1"
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="12"
          />
        </div>

        <textarea
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          placeholder="Sauce on the side, vegetarian, etc."
        />

        <button type="submit" className="w-fit rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
          Add item
        </button>
      </div>
    </form>
  );
}
