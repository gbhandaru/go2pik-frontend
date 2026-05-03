import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CateringStepper from '../components/catering/CateringStepper.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';
import { createCateringRequest } from '../services/cateringApi.js';
import { buildSupportMailtoHref } from '../utils/supportEmail.js';

const STEP_LABELS = ['Event Details', 'Items & Menu', 'Review Items', 'Review & Submit', 'Confirmation'];

export default function CateringFinalReviewPage() {
  const navigate = useNavigate();
  const { draft, draftQuote, registerSubmittedRequest } = useCateringRequest();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const eventDetails = draft.eventDetails || {};
  const items = draft.items || [];
  const visibleItems = items.slice(0, 5);
  const extraItemsCount = Math.max(0, items.length - visibleItems.length);

  const supportHref = buildSupportMailtoHref({
    subject: 'Go2Pik catering support',
    body: 'Hi Go2Pik team, I need help reviewing my catering request.',
  });

  const requestOverview = useMemo(
    () => [
      ['Total Items', items.length || 0],
      ['Total People', eventDetails.guestCount || '-'],
      ['Pickup Location', eventDetails.city || '-'],
      ['Pickup Date & Time', eventDetails.pickupDateTime ? new Date(eventDetails.pickupDateTime).toLocaleString() : '-'],
    ],
    [eventDetails.city, eventDetails.guestCount, eventDetails.pickupDateTime, items.length],
  );

  const validate = () => {
    if (!eventDetails || !eventDetails.eventType || !eventDetails.eventDate || !eventDetails.eventTime) {
      return 'Event details must exist before submitting.';
    }
    if (!items.length) {
      return 'At least one item must exist before submitting.';
    }
    if (Number(eventDetails.guestCount) <= 0) {
      return 'Guest count must be greater than 0.';
    }
    return '';
  };

  const handleSubmit = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        eventDetails,
        items,
        quote: draftQuote,
      };
      const response = await createCateringRequest(payload);
      const request = registerSubmittedRequest({
        requestId: response.requestId,
        status: response.status || 'NEW',
        paymentStatus: 'pending',
        submittedAt: new Date().toISOString(),
        eventDetails,
        items,
        quote: draftQuote,
      });

      if (!request?.requestId) {
        throw new Error('Unable to save catering request.');
      }

      navigate(`/catering/confirmation/${request.requestId}`);
    } catch (submitError) {
      setError(submitError?.message || 'Unable to submit your request right now.');
    } finally {
      setSubmitting(false);
    }
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
            <CateringStepper currentStep={4} steps={STEP_LABELS} />

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
              <article className="space-y-6">
                <header>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Review Your Request</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Please review all the details below before submitting your catering request.
                  </p>
                </header>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <SummaryIcon />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">Event Details</h2>
                      </div>
                    </div>
                    <Link to="/catering/event-details" className="text-sm font-semibold text-violet-700 transition hover:text-violet-600">
                      Edit
                    </Link>
                  </div>

                  <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Event Type" value={eventDetails.eventType || '-'} />
                    <DetailItem label="Event Date" value={eventDetails.eventDate || '-'} />
                    <DetailItem label="Event Time" value={eventDetails.eventTime || '-'} />
                    <DetailItem label="Number of People" value={eventDetails.guestCount || '-'} />
                    <DetailItem label="Pickup Type" value={eventDetails.deliveryType || 'Pickup'} />
                    <DetailItem label="Pickup Location / City" value={eventDetails.city || '-'} />
                    <DetailItem label="Pickup Date & Time" value={eventDetails.pickupDateTime ? new Date(eventDetails.pickupDateTime).toLocaleString() : '-'} />
                    <DetailItem label="Instructions" value={eventDetails.instructions || '-'} />
                  </dl>
                </section>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <ListIcon />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">Items Summary ({items.length} items)</h2>
                      </div>
                    </div>
                    <Link to="/catering/review-items" className="text-sm font-semibold text-violet-700 transition hover:text-violet-600">
                      Edit Items
                    </Link>
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {visibleItems.map((item, index) => (
                            <tr key={item.id} className="align-top">
                              <Td>{index + 1}</Td>
                              <Td>{item.itemName || item.name || '-'}</Td>
                              <Td>{item.quantity || '-'}</Td>
                              <Td>{item.quantityUnit || '-'}</Td>
                              <Td>{item.serves || '-'}</Td>
                              <Td>{item.dietType || '-'}</Td>
                              <Td>{item.spiceLevel || '-'}</Td>
                              <Td>{item.notes || '-'}</Td>
                            </tr>
                          ))}
                          {!visibleItems.length ? (
                            <tr>
                              <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                                No items found. Add items manually.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {extraItemsCount > 0 ? (
                    <p className="mt-3 text-sm font-medium text-violet-700">+ {extraItemsCount} more items</p>
                  ) : null}
                </section>

                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-sm leading-6 text-slate-700">
                  Go2Pik is a pickup-only service. We pick up from multiple restaurants and deliver it to you. No hidden fees.
                </div>

                {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    onClick={() => navigate('/catering/review-items')}
                  >
                    ← Back
                  </button>

                  <div className="flex flex-col items-end">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <span className="mt-2 text-xs text-slate-500">You can track status in My Requests</span>
                  </div>
                </div>
              </article>

              <aside className="lg:sticky lg:top-6 lg:self-start">
                <div className="space-y-4">
                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <OverviewIcon />
                      </div>
                      <h2 className="text-lg font-semibold text-slate-950">Request Overview</h2>
                    </div>

                    <dl className="mt-5 space-y-4 text-sm">
                      {requestOverview.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-4">
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="font-medium text-slate-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>

                  <article className="rounded-[2rem] border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <TimelineIcon />
                      </div>
                      <h2 className="text-lg font-semibold text-slate-950">What happens next?</h2>
                    </div>

                    <ol className="mt-5 space-y-4">
                      {[
                        ["We'll review your request", 'Our team will review your items and check availability.'],
                        ["We'll prepare a quote", 'You\'ll receive a quote with pricing and details.'],
                        ['Review & approve', 'Review the quote and approve your order.'],
                        ['We prepare & you pickup / delivery depending on service setting', 'We prepare the order and get it ready for pickup.'],
                      ].map(([title, copy], index) => (
                        <li key={title} className="flex gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-slate-950">{title}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </article>

                  <article className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Need Help?</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">Our team is here to help you plan the perfect event.</p>
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

function DetailItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function Th({ children }) {
  return <th className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-600">{children}</th>;
}

function Td({ children }) {
  return <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{children}</td>;
}

function SummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M7 2.75A2.75 2.75 0 0 0 4.25 5.5v13A2.75 2.75 0 0 0 7 21.25h10A2.75 2.75 0 0 0 19.75 18.5v-10L14.75 2.75H7Zm5.25 1.5L18.25 10H14A1.75 1.75 0 0 1 12.25 8.25V4.25ZM8 12.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 8 12.25Zm0 3a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 8 15.25Z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M8 4.75A2.75 2.75 0 0 1 10.75 2h5.5A2.75 2.75 0 0 1 19 4.75v14.5A2.75 2.75 0 0 1 16.25 22h-8.5A2.75 2.75 0 0 1 5 19.25V8.25H8A2.75 2.75 0 0 0 10.75 5.5V4.75A.75.75 0 0 1 11.5 4h4.75a.75.75 0 0 1 0 1.5H12.5v.25A2.75 2.75 0 0 1 9.75 8.5H6.5v10.75c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75V4.75a.75.75 0 0 0-.75-.75h-5.5A1.25 1.25 0 0 0 9 5.25V6a.75.75 0 0 1-1.5 0v-.75A2.75 2.75 0 0 1 8 4.75ZM8 12.25a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 8 12.25Zm0 3a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 8 15.25Z" />
    </svg>
  );
}

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M4.75 3A1.75 1.75 0 0 0 3 4.75v14.5C3 20.216 3.784 21 4.75 21h14.5A1.75 1.75 0 0 0 21 19.25V4.75A1.75 1.75 0 0 0 19.25 3H4.75Zm0 1.5h14.5a.25.25 0 0 1 .25.25V7H4.5V4.75a.25.25 0 0 1 .25-.25ZM4.5 8.5h15v10.75a.25.25 0 0 1-.25.25H4.75a.25.25 0 0 1-.25-.25V8.5Zm2 2.25a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M12 2a1 1 0 0 1 1 1v.17A8.5 8.5 0 0 1 19.83 10H20a1 1 0 1 1 0 2h-.17A8.5 8.5 0 0 1 13 18.83V19a1 1 0 1 1-2 0v-.17A8.5 8.5 0 0 1 4.17 12H4a1 1 0 1 1 0-2h.17A8.5 8.5 0 0 1 11 3.17V3a1 1 0 0 1 1-1Zm0 3.5A6.5 6.5 0 1 0 18.5 12 6.51 6.51 0 0 0 12 5.5Zm.75 2.25v3.69l2.54 1.52a.75.75 0 1 1-.77 1.29l-2.92-1.75A.75.75 0 0 1 11.25 12V7.75a.75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}
