import { Link, useNavigate, useParams } from 'react-router-dom';
import CateringSummaryCard from '../components/catering/CateringSummaryCard.jsx';
import QuoteSummaryCard from '../components/catering/QuoteSummaryCard.jsx';
import RequestStatusBadge from '../components/catering/RequestStatusBadge.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';

export default function RequestDetailsPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { getRequestById } = useCateringRequest();
  const request = getRequestById(requestId);

  if (!request) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-semibold text-slate-950">Request not found</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">This request ID is not present in the local request store.</p>
            <button type="button" className="mt-5 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white" onClick={() => navigate('/my-requests')}>
              Back to requests
            </button>
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
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Request details</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{request.eventDetails.eventName || 'Catering request'}</h1>
              <p className="mt-2 text-sm text-slate-600">Request ID: {request.requestId}</p>
            </div>
            <RequestStatusBadge status={request.paymentStatus === 'paid' ? 'confirmed' : request.paymentStatus === 'pending' ? 'payment_pending' : request.status} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <CateringSummaryCard eventDetails={request.eventDetails} items={request.items} />
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Timeline</p>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <dt>Submitted</dt>
                  <dd className="font-medium text-slate-900">{new Date(request.submittedAt).toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Payment status</dt>
                  <dd className="font-medium text-slate-900">{request.paymentStatus}</dd>
                </div>
              </dl>
            </div>
          </div>

          <QuoteSummaryCard
            quote={request.quote}
            title="Quote summary"
            primaryActionLabel="Open payment"
            onPrimaryAction={() => navigate(`/my-requests/${request.requestId}/payment`)}
            secondaryActionLabel="Back to requests"
            onSecondaryAction={() => navigate('/my-requests')}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/my-requests" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            Back
          </Link>
        </div>
      </section>
    </main>
  );
}
