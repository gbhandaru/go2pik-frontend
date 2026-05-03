import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CateringStepper from '../components/catering/CateringStepper.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';
import { buildSupportMailtoHref } from '../utils/supportEmail.js';

const STEP_LABELS = ['Event Details', 'Items & Menu', 'Review Items', 'Review & Submit', 'Confirmation'];
const QUANTITY_UNITS = ['Tray', 'Plates', 'Pieces', 'Kg', 'Lbs'];
const DIET_TYPES = ['Veg', 'Non-Veg', 'Vegan', 'Jain', 'Egg'];
const SPICE_LEVELS = ['Mild', 'Medium', 'Spicy', 'Extra Spicy'];
const SUPPORTED_FORMATS = 'Excel, CSV, PDF, Image (JPG, PNG)';
const MAX_FILE_SIZE_MB = 10;

const emptyManualItem = {
  itemName: '',
  quantity: '',
  quantityUnit: 'Tray',
  serves: '',
  dietType: '',
  spiceLevel: '',
  notes: '',
};

const emptyErrors = {
  file: '',
  itemName: '',
  quantity: '',
  serves: '',
  form: '',
};

export default function CateringItemsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { draft, setUploadedFile, addItem, updateItem, removeItem } = useCateringRequest();
  const [manualItem, setManualItem] = useState(emptyManualItem);
  const [errors, setErrors] = useState(emptyErrors);
  const [dragActive, setDragActive] = useState(false);

  const items = draft.items || [];
  const uploadedFile = draft.uploadedFile || null;
  const eventSummary = draft.eventDetails || {};

  const itemTotal = useMemo(() => items.length, [items]);

  const supportHref = buildSupportMailtoHref({
    subject: 'Go2Pik catering help',
    body: 'Hi Go2Pik team, I need help with my catering item list.',
  });

  const handleFile = (file) => {
    if (!file) {
      setUploadedFile(null);
      return;
    }

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrors((current) => ({
        ...current,
        file: `File must be ${MAX_FILE_SIZE_MB}MB or smaller.`,
      }));
      return;
    }

    setErrors((current) => ({ ...current, file: '' }));
    setUploadedFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] || null;
    handleFile(file);
  };

  const validateManualItem = () => {
    const nextErrors = { ...emptyErrors };
    if (!manualItem.itemName.trim()) {
      nextErrors.itemName = 'Item name is required.';
    }
    if (!manualItem.quantity || Number(manualItem.quantity) <= 0) {
      nextErrors.quantity = 'Quantity is required.';
    }
    if (!manualItem.serves || Number(manualItem.serves) <= 0) {
      nextErrors.serves = 'Serves is required.';
    }
    return nextErrors;
  };

  const handleManualItemChange = (field, value) => {
    setManualItem((current) => ({
      ...current,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((current) => ({
        ...current,
        [field]: '',
      }));
    }
  };

  const handleAddItem = () => {
    const nextErrors = validateManualItem();
    const hasManualErrors = Object.values(nextErrors).some(Boolean);
    if (hasManualErrors) {
      setErrors((current) => ({
        ...current,
        ...nextErrors,
      }));
      return;
    }

    addItem({
      itemName: manualItem.itemName.trim(),
      quantity: Number(manualItem.quantity),
      quantityUnit: manualItem.quantityUnit,
      serves: manualItem.serves.trim(),
      dietType: manualItem.dietType,
      spiceLevel: manualItem.spiceLevel,
      notes: manualItem.notes.trim(),
    });

    setManualItem(emptyManualItem);
    setErrors(emptyErrors);
  };

  const handleContinue = () => {
    if (!uploadedFile && items.length === 0) {
      setErrors((current) => ({
        ...current,
        form: 'Please upload a list or add at least one item.',
      }));
      return;
    }

    setErrors(emptyErrors);
    navigate('/catering/review-items');
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
            <CateringStepper currentStep={2} steps={STEP_LABELS} />

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
              <article className="space-y-6">
                <header>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Tell us what you need</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Upload your list or add items manually. We&apos;ll help source from multiple restaurants.
                  </p>
                </header>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">Upload Your List (Recommended)</h2>
                      <p className="mt-1 text-sm text-slate-600">Upload Excel, CSV, PDF, or an image of your menu / list</p>
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      Max file size: {MAX_FILE_SIZE_MB}MB
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_0.9fr]">
                    <div
                      className={[
                        'rounded-[1.75rem] border-2 border-dashed p-5 text-center transition',
                        dragActive ? 'border-violet-400 bg-violet-50' : 'border-violet-200 bg-white',
                      ].join(' ')}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setDragActive(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                        <UploadIcon />
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-950">Drag & drop your file here</p>
                      <p className="mt-1 text-sm text-slate-500">or</p>
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse Files
                      </button>
                      <p className="mt-4 text-sm text-slate-600">Supported formats: {SUPPORTED_FORMATS}</p>
                      {errors.file ? <p className="mt-2 text-sm font-medium text-rose-600">{errors.file}</p> : null}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".csv,.xls,.xlsx,.pdf,.png,.jpg,.jpeg"
                        onChange={(event) => handleFile(event.target.files?.[0] || null)}
                      />
                    </div>

                    <div className="rounded-[1.75rem] bg-gradient-to-br from-violet-50 to-white p-5">
                      <h3 className="text-base font-semibold text-slate-950">Tips for best results</h3>
                      <ul className="mt-4 space-y-4 text-sm text-slate-600">
                        <li className="flex gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-violet-700 shadow-sm ring-1 ring-violet-100">
                            1
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">Use clear item names</p>
                            <p>e.g. Paneer Butter Masala</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-violet-700 shadow-sm ring-1 ring-violet-100">
                            2
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">Include quantity</p>
                            <p>e.g. 2 trays or 20 plates</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-violet-700 shadow-sm ring-1 ring-violet-100">
                            3
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">Mention special notes</p>
                            <p>e.g. less spicy, no onion</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {uploadedFile ? (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">{uploadedFile.name}</p>
                        <p className="text-slate-500">{Math.ceil(uploadedFile.size / 1024)} KB selected</p>
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
                        onClick={() => handleFile(null)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">Add Items Manually</h2>
                      <p className="mt-1 text-sm text-slate-600">Add items one by one</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{itemTotal} item{itemTotal === 1 ? '' : 's'} added</span>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
                    <InputField
                      label="Item Name"
                      required
                      error={errors.itemName}
                      className="xl:col-span-2"
                    >
                      <input
                        value={manualItem.itemName}
                        onChange={(event) => handleManualItemChange('itemName', event.target.value)}
                        className={inputClass}
                        placeholder="e.g. Veg Biryani"
                      />
                    </InputField>

                    <InputField label="Quantity" required error={errors.quantity}>
                      <input
                        type="number"
                        min="1"
                        value={manualItem.quantity}
                        onChange={(event) => handleManualItemChange('quantity', event.target.value)}
                        className={inputClass}
                        placeholder="e.g. 2"
                      />
                    </InputField>

                    <InputField label="Unit">
                      <select
                        value={manualItem.quantityUnit}
                        onChange={(event) => handleManualItemChange('quantityUnit', event.target.value)}
                        className={inputClass}
                      >
                        {QUANTITY_UNITS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </InputField>

                    <InputField label="Serves" required error={errors.serves}>
                      <input
                        type="number"
                        min="1"
                        value={manualItem.serves}
                        onChange={(event) => handleManualItemChange('serves', event.target.value)}
                        className={inputClass}
                        placeholder="e.g. 20 people"
                      />
                    </InputField>

                    <InputField label="Diet Type">
                      <select
                        value={manualItem.dietType}
                        onChange={(event) => handleManualItemChange('dietType', event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select</option>
                        {DIET_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </InputField>

                    <InputField label="Spice Level">
                      <select
                        value={manualItem.spiceLevel}
                        onChange={(event) => handleManualItemChange('spiceLevel', event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select (Optional)</option>
                        {SPICE_LEVELS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </InputField>

                    <InputField label="Special Notes" className="xl:col-span-5">
                      <input
                        value={manualItem.notes}
                        onChange={(event) => handleManualItemChange('notes', event.target.value)}
                        className={inputClass}
                        placeholder="Optional notes for the restaurant"
                      />
                    </InputField>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="inline-flex w-full items-center justify-center rounded-full border border-violet-300 bg-white px-5 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-50"
                      >
                        + Add Item
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <Th>#</Th>
                            <Th>Item Name</Th>
                            <Th>Quantity</Th>
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
                              <td colSpan={8} className="px-6 py-16 text-center">
                                <div className="mx-auto max-w-sm">
                                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                                    <EmptyStateIcon />
                                  </div>
                                  <p className="mt-4 text-base font-semibold text-slate-950">No items added yet</p>
                                  <p className="mt-1 text-sm text-slate-500">Upload your list or add items manually.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            items.map((item, index) => (
                              <tr key={item.id} className="align-top">
                                <Td>{index + 1}</Td>
                                <Td>
                                  <input
                                    value={item.itemName || item.name || ''}
                                    onChange={(event) => updateItem(item.id, { itemName: event.target.value })}
                                    className={inlineInputClass}
                                  />
                                </Td>
                                <Td>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                                    className={`${inlineInputClass} w-24`}
                                  />
                                </Td>
                                <Td>
                                  <input
                                    value={item.serves || ''}
                                    onChange={(event) => updateItem(item.id, { serves: event.target.value })}
                                    className={inlineInputClass}
                                  />
                                </Td>
                                <Td>
                                  <select
                                    value={item.dietType || ''}
                                    onChange={(event) => updateItem(item.id, { dietType: event.target.value })}
                                    className={inlineInputClass}
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
                                    onChange={(event) => updateItem(item.id, { spiceLevel: event.target.value })}
                                    className={inlineInputClass}
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
                                    onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                                    className={inlineInputClass}
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

                  {errors.form ? <p className="mt-4 text-sm font-medium text-rose-600">{errors.form}</p> : null}
                </section>

                <div className="flex flex-col gap-4 rounded-[1.5rem] bg-violet-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-slate-700">
                    Go2Pik is a pickup-only service. No delivery, no hidden fees.
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                    onClick={handleContinue}
                  >
                    Save &amp; Continue
                  </button>
                </div>
              </article>

              <aside className="lg:sticky lg:top-6 lg:self-start">
                <div className="space-y-4">
                  <article className="rounded-[2rem] border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <SummaryIcon />
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">Your Event Summary</p>
                      </div>
                    </div>

                    <dl className="mt-5 space-y-4 text-sm">
                      <SummaryRow label="Event Type" value={eventSummary.eventType || '-'} />
                      <SummaryRow label="Event Date" value={eventSummary.eventDate || '-'} />
                      <SummaryRow label="Event Time" value={eventSummary.eventTime || '-'} />
                      <SummaryRow label="Number of People" value={eventSummary.guestCount || '-'} />
                      <SummaryRow label="Pickup Location / City" value={eventSummary.city || '-'} />
                      <SummaryRow
                        label="Pickup Date & Time"
                        value={eventSummary.pickupDateTime ? new Date(eventSummary.pickupDateTime).toLocaleString() : '-'}
                      />
                      <SummaryRow label="Instructions" value={eventSummary.instructions || '-'} />
                    </dl>
                  </article>

                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Need help?</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Our team can help you plan the perfect menu.</p>
                    <a
                      href={supportHref}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      Contact Support
                    </a>
                  </article>

                  <article className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Pickup-Only Service</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      We pick up from multiple restaurants and deliver it to you. No delivery, no hidden fees.
                    </p>
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

function InputField({ label, required = false, error = '', className = '', children }) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="ml-1 text-violet-600">*</span> : null}
      </span>
      {children}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </label>
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

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100';

const inlineInputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100';

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-current">
      <path d="M12 3a1 1 0 0 1 .7.29l4 4a1 1 0 1 1-1.4 1.42L13 6.41V15a1 1 0 1 1-2 0V6.41L8.7 8.71A1 1 0 0 1 7.3 7.29l4-4A1 1 0 0 1 12 3ZM5 14a1 1 0 0 1 1 1v3h12v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a1 1 0 0 1 1-1Z" />
    </svg>
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
