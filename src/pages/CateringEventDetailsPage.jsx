import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CateringStepper from '../components/catering/CateringStepper.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';
import { buildSupportMailtoHref } from '../utils/supportEmail.js';

const STEP_LABELS = ['Event Details', 'Items & Menu', 'Review Items', 'Review & Submit', 'Confirmation'];
const CITY_OPTIONS = ['Antioch', 'Brentwood', 'Oakley'];
const EVENT_TYPES = ['Birthday', 'Corporate Event', 'Wedding', 'Graduation', 'Office Lunch', 'Other'];

function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeForDisplay(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLocalDateTime(value) {
  if (!value) {
    return '';
  }

  if (value.length === 16) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return '';
  }

  return `${dateValue}T${timeValue}`;
}

function isDateTimeInPast(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return date.getTime() < Date.now();
}

function buildInitialForm(eventDetails = {}) {
  const pickupLocal = formatLocalDateTime(eventDetails.pickupDateTime || '');

  return {
    eventType: eventDetails.eventType || '',
    eventDate: eventDetails.eventDate || '',
    eventTime: eventDetails.eventTime || '',
    guestCount: eventDetails.guestCount || '',
    deliveryType: eventDetails.deliveryType || 'Pickup',
    city: eventDetails.city || 'Antioch',
    pickupDateTime: pickupLocal,
    instructions: eventDetails.instructions || eventDetails.notes || '',
  };
}

export default function CateringEventDetailsPage() {
  const navigate = useNavigate();
  const { draft, updateEventDetails } = useCateringRequest();
  const [form, setForm] = useState(() => buildInitialForm(draft.eventDetails));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const supportHref = buildSupportMailtoHref({
    subject: 'Go2Pik catering support',
    body: 'Hi Go2Pik team, I need help with my catering request details.',
  });

  const summary = useMemo(
    () => ({
      eventType: form.eventType || '-',
      eventDate: form.eventDate || '-',
      eventTime: form.eventTime || '-',
      guestCount: form.guestCount || '-',
      deliveryType: form.deliveryType || '-',
      city: form.city || '-',
      pickupDateTime: form.pickupDateTime ? formatDateTimeForDisplay(form.pickupDateTime) : '-',
      instructions: form.instructions?.trim() || '-',
    }),
    [form],
  );

  const validate = () => {
    const nextErrors = {};
    const now = Date.now();

    if (!form.eventType.trim()) {
      nextErrors.eventType = 'Event type is required.';
    }
    if (!form.eventDate) {
      nextErrors.eventDate = 'Event date is required.';
    }
    if (!form.eventTime) {
      nextErrors.eventTime = 'Event time is required.';
    }
    if (!form.guestCount || Number(form.guestCount) <= 0) {
      nextErrors.guestCount = 'Number of people must be greater than 0.';
    }
    if (!form.deliveryType) {
      nextErrors.deliveryType = 'Delivery / pickup is required.';
    }
    if (!form.city) {
      nextErrors.city = 'Pickup location / city is required.';
    }
    if (!form.pickupDateTime) {
      nextErrors.pickupDateTime = 'Pickup date and time are required.';
    }
    if (!form.instructions?.trim()) {
      nextErrors.instructions = 'Additional instructions are required.';
    }
    if (form.instructions && form.instructions.length > 300) {
      nextErrors.instructions = 'Instructions must be 300 characters or fewer.';
    }

    if (form.eventDate && form.eventTime) {
      const eventDateTime = new Date(`${form.eventDate}T${form.eventTime}`);
      if (Number.isNaN(eventDateTime.getTime()) || eventDateTime.getTime() < now) {
        nextErrors.eventDate = 'Event date and time cannot be in the past.';
        nextErrors.eventTime = 'Event date and time cannot be in the past.';
      }
    }

    if (form.pickupDateTime && isDateTimeInPast(form.pickupDateTime)) {
      nextErrors.pickupDateTime = 'Pickup date and time cannot be in the past.';
    }

    return nextErrors;
  };

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
    if (errors[field]) {
      setErrors((current) => ({
        ...current,
        [field]: '',
      }));
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setTouched({
      eventType: true,
      eventDate: true,
      eventTime: true,
      guestCount: true,
      deliveryType: true,
      city: true,
      pickupDateTime: true,
      instructions: true,
    });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    updateEventDetails({
      eventType: form.eventType.trim(),
      eventDate: form.eventDate,
      eventTime: form.eventTime,
      guestCount: Number(form.guestCount),
      deliveryType: form.deliveryType,
      city: form.city,
      pickupDateTime: form.pickupDateTime,
      instructions: form.instructions.trim(),
      notes: form.instructions.trim(),
    });
    navigate('/catering/items');
  };

  const fieldError = (field) => touched[field] && errors[field] ? errors[field] : '';

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-violet-700 transition hover:text-violet-600">
                <span aria-hidden="true">←</span>
                Back to Home
              </Link>
              <p className="text-sm font-medium text-slate-500">Go2Pik Catering Flow</p>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-8">
            <CateringStepper currentStep={1} steps={STEP_LABELS} />

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px]">
              <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-700">Step 1 of 5</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Tell us about your event</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Help us understand your requirements</p>

                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Event Type" required error={fieldError('eventType')}>
                      <select
                        value={form.eventType}
                        onChange={(event) => handleChange('eventType', event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select event type</option>
                        {EVENT_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Event Date" required error={fieldError('eventDate')}>
                      <input
                        type="date"
                        value={form.eventDate}
                        onChange={(event) => handleChange('eventDate', event.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Event Time" required error={fieldError('eventTime')}>
                      <input
                        type="time"
                        value={form.eventTime}
                        onChange={(event) => handleChange('eventTime', event.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Number of People" required error={fieldError('guestCount')}>
                      <input
                        type="number"
                        min="1"
                        value={form.guestCount}
                        onChange={(event) => handleChange('guestCount', event.target.value)}
                        className={inputClass}
                        placeholder="25"
                      />
                    </Field>

                    <Field label="Delivery / Pickup" required error={fieldError('deliveryType')}>
                      <select
                        value={form.deliveryType}
                        onChange={(event) => handleChange('deliveryType', event.target.value)}
                        className={inputClass}
                      >
                        <option value="Pickup">Pickup</option>
                        <option value="Delivery" disabled>
                          Delivery (not available)
                        </option>
                      </select>
                    </Field>

                    <Field label="Pickup Location / City" required error={fieldError('city')}>
                      <select
                        value={form.city}
                        onChange={(event) => handleChange('city', event.target.value)}
                        className={inputClass}
                      >
                        {CITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Pickup Date & Time" required className="md:col-span-2 xl:col-span-3" error={fieldError('pickupDateTime')}>
                      <input
                        type="datetime-local"
                        value={form.pickupDateTime}
                        onChange={(event) => handleChange('pickupDateTime', event.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Additional Instructions" required className="md:col-span-2 xl:col-span-3" error={fieldError('instructions')}>
                      <textarea
                        rows={5}
                        maxLength={300}
                        value={form.instructions}
                        onChange={(event) => handleChange('instructions', event.target.value.slice(0, 300))}
                        className={`${inputClass} min-h-[140px] resize-none`}
                        placeholder="Any special requests, notes about the event, parking instructions, etc."
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Required for this step</span>
                        <span>{form.instructions.length}/300</span>
                      </div>
                    </Field>
                  </div>

                  <div className="flex flex-col gap-4 rounded-[1.5rem] bg-violet-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-slate-700">
                      Go2Pik is a pickup-only service. No delivery, no hidden fees.
                    </p>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                    >
                      Save &amp; Continue
                    </button>
                  </div>
                </form>
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

                    <div className="mt-5 space-y-4 text-sm">
                      <SummaryItem label="eventType" value={summary.eventType} />
                      <SummaryItem label="date" value={summary.eventDate} />
                      <SummaryItem label="time" value={summary.eventTime} />
                      <SummaryItem label="people" value={summary.guestCount} />
                      <SummaryItem label="location" value={summary.city} />
                      <SummaryItem label="pickup time" value={summary.pickupDateTime} />
                      <SummaryItem label="notes" value={summary.instructions} />
                    </div>
                  </article>

                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Need help?</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Our team is here to help you plan the perfect experience.</p>
                    <a
                      href={supportHref}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      Contact
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

function Field({ label, required = false, error = '', className = '', children }) {
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

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-violet-100">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  );
}

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100';

function SummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M7 2.75A2.75 2.75 0 0 0 4.25 5.5v13A2.75 2.75 0 0 0 7 21.25h10A2.75 2.75 0 0 0 19.75 18.5v-10L14.75 2.75H7Zm5.25 1.5L18.25 10H14A1.75 1.75 0 0 1 12.25 8.25V4.25ZM8 12.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 8 12.25Zm0 3a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 8 15.25Z" />
    </svg>
  );
}
