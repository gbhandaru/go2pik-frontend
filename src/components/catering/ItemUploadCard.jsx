export default function ItemUploadCard({ fileName = '', onFileChange }) {
  return (
    <section className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/70 p-5">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Upload</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Bring in a menu or draft list</h3>
          <p className="mt-1 text-sm text-slate-600">
            AI parsing is not connected yet, but you can attach a reference file now and continue manually.
          </p>
        </div>

        <label className="inline-flex w-fit cursor-pointer items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-300">
          <input type="file" className="sr-only" accept=".csv,.txt,.pdf,.png,.jpg,.jpeg" onChange={(event) => onFileChange?.(event.target.files?.[0] || null)} />
          Choose file
        </label>

        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          {fileName ? (
            <span>
              Selected file: <strong className="text-slate-900">{fileName}</strong>
            </span>
          ) : (
            <span>No file selected yet.</span>
          )}
        </div>
      </div>
    </section>
  );
}
