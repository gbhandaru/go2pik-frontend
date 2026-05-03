export default function ParsedItemsTable({ items = [], onUpdateItem, onRemoveItem, readOnly = false }) {
  if (!items.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
        No items yet. Add a few manually to keep the request moving.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Item</th>
            <th className="px-5 py-3 font-medium">Quantity</th>
            <th className="px-5 py-3 font-medium">Notes</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-5 py-4">
                <div className="font-medium text-slate-900">{item.name}</div>
              </td>
              <td className="px-5 py-4">
                {readOnly ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.quantity}</span>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => onUpdateItem?.(item.id, { quantity: Number(event.target.value) || 1 })}
                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                )}
              </td>
              <td className="px-5 py-4 text-slate-600">
                {readOnly ? (
                  item.notes || <span className="text-slate-400">No notes</span>
                ) : (
                  <input
                    value={item.notes}
                    onChange={(event) => onUpdateItem?.(item.id, { notes: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Item notes"
                  />
                )}
              </td>
              <td className="px-5 py-4 text-right">
                {!readOnly ? (
                  <button type="button" className="text-sm font-semibold text-rose-600 transition hover:text-rose-700" onClick={() => onRemoveItem?.(item.id)}>
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
