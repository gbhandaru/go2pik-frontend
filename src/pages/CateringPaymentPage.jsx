import { useNavigate, useParams } from 'react-router-dom';
import CateringSummaryCard from '../components/catering/CateringSummaryCard.jsx';
import QuoteSummaryCard from '../components/catering/QuoteSummaryCard.jsx';
import RequestStatusBadge from '../components/catering/RequestStatusBadge.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';

export default function CateringPaymentPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { getRequestById } = useCateringRequest();
  const request = getRequestById(requestId);

  if (!request) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-semibold text-slate-950">Payment request not found</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">The local request store does not contain this request ID.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Payment</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Catering payment</h1>
              <p className="mt-2 text-sm text-slate-600">Stripe is not connected yet, so this page is a placeholder for the future checkout flow.</p>
            </div>
            <RequestStatusBadge status="payment_pending" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <CateringSummaryCard eventDetails={request.eventDetails} items={request.items} />
            <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Stripe later</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Checkout is intentionally disabled for now</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                This page keeps the route in place so the front end can be connected to Stripe later without changing the flow.
              </p>
            </div>
          </div>

          <QuoteSummaryCard
            quote={request.quote}
            title="Amount due"
            primaryActionLabel="Back to request"
            onPrimaryAction={() => navigate(`/my-requests/${request.requestId}`)}
            secondaryActionLabel="My requests"
            onSecondaryAction={() => navigate('/my-requests')}
          />
        </div>
      </section>
    </main>
  );
}
