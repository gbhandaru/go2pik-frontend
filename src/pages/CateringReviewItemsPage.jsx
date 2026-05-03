import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CateringStepper from '../components/catering/CateringStepper.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';
import { buildSupportMailtoHref } from '../utils/supportEmail.js';

const STEP_LABELS = ['Event Details', 'Items & Menu', 'Review Items', 'Review & Submit', 'Confirmation'];
const QUANTITY_UNITS = ['Tray', 'Half Tray', 'Plates', 'Pieces', 'Kg', 'Lbs'];
const DIET_TYPES = ['Veg', 'Non-Veg', 'Vegan', 'Jain', 'Egg'];
const SPICE_LEVELS = ['Mild', 'Medium', 'Spicy', 'Extra Spicy', 'Not Applicable'];

const DEFAULT_MOCK_ITEMS = [
  {
    itemName: 'Veg Biryani',
    quantity: 2,
    quantityUnit: 'Tray',
    serves: '20',
    dietType: 'Veg',
    spiceLevel: 'Medium',
    notes: '',
  },
  {
    itemName: 'Paneer Butter Masala',
    quantity: 1,
    quantityUnit: 'Tray',
    serves: '20',
    dietType: 'Veg',
    spiceLevel: 'Mild',
    notes: '',
  },
  {
    itemName: 'Chicken 65',
    quantity: 1,
    quantityUnit: 'Tray',
    serves: '25',
    dietType: 'Non-Veg',
    spiceLevel: 'Spicy',
    notes: 'Boneless',
  },
];

export default function CateringReviewItemsPage() {
  const navigate = useNavigate();
  const { draft, setItems, addItem, updateItem, removeItem } = useCateringRequest();
  const [seededFromUpload, setSeededFromUpload] = useState(false);
  const [errors, setErrors] = useState({});

  const items = draft.items || [];
  const uploadedFile = draft.uploadedFile || null;
  const eventDetails = draft.eventDetails || {};

  useEffect(() => {
    if (seededFromUpload) {
      return;
    }
    if (uploadedFile && items.length === 0) {
      setItems(DEFAULT_MOCK_ITEMS);
      setSeededFromUpload(true);
    }
  }, [items.length, seededFromUpload, setItems, uploadedFile]);

  const totalCount = useMemo(() => items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0), [items]);

  const supportHref = buildSupportMailtoHref({
    subject: 'Go2Pik catering help',
    body: 'Hi Go2Pik team, I need help reviewing my catering items.',
  });

  const handleUploadDifferentFile = () => {
    navigate('/catering/items');
  };

  const handleAddBlankRow = () => {
    addItem({
      itemName: '',
      quantity: 1,
      quantityUnit: 'Tray',
      serves: '',
      dietType: '',
      spiceLevel: '',
      notes: '',
    }, { allowBlank: true });
  };

  const handleContinue = () => {
    if (!items.length) {
      setErrors({ form: 'No items found. Add items manually.' });
      return;
    }

    const invalid = items.some((item) => !String(item.itemName || '').trim() || Number(item.quantity) <= 0 || !String(item.serves || '').trim());
    if (invalid) {
      setErrors({ form: 'Please fix the highlighted items before continuing.' });
      return;
    }

    setErrors({});
    navigate('/catering/review');
  };

  const renderEventValue = (value) => (value ? value : '-');

  const updateRow = (itemId, updates) => {
    updateItem(itemId, updates);
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-8">
            <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-violet-700 transition hover:text-violet-600">
              <span aria-hidden="true">←</span>
              Back to Home
            </Link>
          </div>

          <div className="px-5 py-5 sm:px-8">
            <CateringStepper currentStep={3} steps={STEP_LABELS} />

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
              <article className="space-y-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Review &amp; Edit Your Items</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      We&apos;ve extracted the items from your list. Please review and make any changes.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleUploadDifferentFile}
                      className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      Upload Different File
                    </button>
                    <button
                      type="button"
                      onClick={handleAddBlankRow}
                      className="inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                    >
                      + Add Item Manually
                    </button>
                  </div>
                </header>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">AI Extracted Items</h2>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">BETA</span>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <p className="font-medium text-slate-900">{uploadedFile?.name ? `File: ${uploadedFile.name}` : 'No file uploaded'}</p>
                      <p className="mt-1 text-slate-600">
                        {uploadedFile ? 'We extracted the items from your file.' : 'No uploaded file found. Add items manually or upload a different file.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {uploadedFile ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Parsed Successfully</span> : null}
                      <span className="text-sm font-medium text-slate-600">{items.length} items found</span>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-[1100px] w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <Th>#</Th>
                            <Th>Item Name</Th>
                            <Th>Quantity</Th>
                            <Th>Unit</Th>
                            <Th>Serves</Th>
                            <Th>Diet Type</Th>
                            <Th>Spice Level</Th>
                            <Th>Special Notes</Th>
                            <Th>Actions</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {items.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-6 py-16 text-center">
                                <div className="mx-auto max-w-sm">
                                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                                    <EmptyStateIcon />
                                  </div>
                                  <p className="mt-4 text-base font-semibold text-slate-950">No items found. Add items manually.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            items.map((item, index) => (
                              <tr key={item.id} className="align-top">
                                <Td>{index + 1}</Td>
                                <Td>
                                  <input
                                    value={item.itemName || ''}
                                    onChange={(event) => updateRow(item.id, { itemName: event.target.value })}
                                    className={inputClass}
                                    placeholder="Item name"
                                  />
                                </Td>
                                <Td>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(event) => updateRow(item.id, { quantity: event.target.value })}
                                    className={`${inputClass} w-24`}
                                    placeholder="1"
                                  />
                                </Td>
                                <Td>
                                  <select
                                    value={item.quantityUnit || 'Tray'}
                                    onChange={(event) => updateRow(item.id, { quantityUnit: event.target.value })}
                                    className={inputClass}
                                  >
                                    {QUANTITY_UNITS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </Td>
                                <Td>
                                  <input
                                    value={item.serves || ''}
                                    onChange={(event) => updateRow(item.id, { serves: event.target.value })}
                                    className={inputClass}
                                    placeholder="20 people"
                                  />
                                </Td>
                                <Td>
                                  <select
                                    value={item.dietType || ''}
                                    onChange={(event) => updateRow(item.id, { dietType: event.target.value })}
                                    className={inputClass}
                                  >
                                    <option value="">Select</option>
                                    {DIET_TYPES.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </Td>
                                <Td>
                                  <select
                                    value={item.spiceLevel || ''}
                                    onChange={(event) => updateRow(item.id, { spiceLevel: event.target.value })}
                                    className={inputClass}
                                  >
                                    <option value="">Select</option>
                                    {SPICE_LEVELS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </Td>
                                <Td>
                                  <input
                                    value={item.notes || ''}
                                    onChange={(event) => updateRow(item.id, { notes: event.target.value })}
                                    className={inputClass}
                                    placeholder="Special notes"
                                  />
                                </Td>
                                <Td>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    className="font-semibold text-rose-600 transition hover:text-rose-700"
                                  >
                                    Delete
                                  </button>
                                </Td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handleAddBlankRow}
                      className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      + Add Another Item
                    </button>
                    <p className="text-sm font-medium text-slate-700">
                      Total Items: <span className="font-semibold text-slate-950">{totalCount}</span>
                    </p>
                  </div>

                  {errors.form ? <p className="mt-4 text-sm font-medium text-rose-600">{errors.form}</p> : null}

                  <div className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                    <p className="text-sm font-medium text-emerald-900">AI not perfect?</p>
                    <p className="mt-1 text-sm text-slate-600">You can edit any item, delete incorrect items, or add new ones manually.</p>
                  </div>
                </section>

                <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => navigate('/catering/items')}
                    className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    ← Back
                  </button>
                  <div className="flex flex-col items-end">
                    <button
                      type="button"
                      onClick={handleContinue}
                      className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                    >
                      Save &amp; Continue
                    </button>
                    <span className="mt-2 text-xs text-slate-500">Next: Review &amp; Submit</span>
                  </div>
                </div>
              </article>

              <aside className="lg:sticky lg:top-6 lg:self-start">
                <div className="space-y-4">
                  <article className="rounded-[2rem] border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                          <SummaryIcon />
                        </div>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">Your Event Summary</p>
                        </div>
                      </div>
                      <Link to="/catering/event-details" className="text-sm font-semibold text-violet-700 transition hover:text-violet-600">
                        Edit
                      </Link>
                    </div>

                    <dl className="mt-5 space-y-4 text-sm">
                      <SummaryRow label="Event Type" value={renderEventValue(eventDetails.eventType)} />
                      <SummaryRow label="Event Date" value={renderEventValue(eventDetails.eventDate)} />
                      <SummaryRow label="Event Time" value={renderEventValue(eventDetails.eventTime)} />
                      <SummaryRow label="Number of People" value={renderEventValue(eventDetails.guestCount)} />
                      <SummaryRow label="Pickup Location / City" value={renderEventValue(eventDetails.city)} />
                      <SummaryRow label="Pickup Date &amp; Time" value={eventDetails.pickupDateTime ? new Date(eventDetails.pickupDateTime).toLocaleString() : '-'} />
                      <SummaryRow label="Instructions" value={renderEventValue(eventDetails.instructions)} />
                    </dl>
                  </article>

                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Tips for best results</p>
                    <ul className="mt-4 space-y-4 text-sm text-slate-600">
                      <li className="flex gap-3">
                        <CheckBullet />
                        <div>
                          <p className="font-medium text-slate-900">Verify item names and quantities</p>
                          <p>Make sure everything looks correct.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <CheckBullet />
                        <div>
                          <p className="font-medium text-slate-900">Check serves count</p>
                          <p>Helps us plan the right portions.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <CheckBullet />
                        <div>
                          <p className="font-medium text-slate-900">Add special notes</p>
                          <p>Mention spice level, no onion, Jain food, etc.</p>
                        </div>
                      </li>
                    </ul>
                  </article>

                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Need help?</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Our team can help you plan the perfect menu.</p>
                    <a
                      href={supportHref}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      Chat with Us
                    </a>
                  </article>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Th({ children }) {
  return <th className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-600">{children}</th>;
}

function Td({ children }) {
  return <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{children}</td>;
}

function CheckBullet() {
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[2.5]">
        <path d="M4 10.5 8 14.5 16 5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function SummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M7 2.75A2.75 2.75 0 0 0 4.25 5.5v13A2.75 2.75 0 0 0 7 21.25h10A2.75 2.75 0 0 0 19.75 18.5v-10L14.75 2.75H7Zm5.25 1.5L18.25 10H14A1.75 1.75 0 0 1 12.25 8.25V4.25ZM8 12.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 8 12.25Zm0 3a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 8 15.25Z" />
    </svg>
  );
}

function EmptyStateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-current">
      <path d="M5 4.75A2.75 2.75 0 0 1 7.75 2h8.5A2.75 2.75 0 0 1 19 4.75v14.5A2.75 2.75 0 0 1 16.25 22h-8.5A2.75 2.75 0 0 1 5 19.25V4.75Zm2.75-.75a.75.75 0 0 0-.75.75v14.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75V4.75a.75.75 0 0 0-.75-.75h-8.5Z" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100';
