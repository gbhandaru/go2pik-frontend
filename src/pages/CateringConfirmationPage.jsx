import { Link, useNavigate, useParams } from 'react-router-dom';
import CateringStepper from '../components/catering/CateringStepper.jsx';
import CateringSummaryCard from '../components/catering/CateringSummaryCard.jsx';
import QuoteSummaryCard from '../components/catering/QuoteSummaryCard.jsx';
import RequestStatusBadge from '../components/catering/RequestStatusBadge.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';

export default function CateringConfirmationPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { getRequestById, draft, draftQuote } = useCateringRequest();
  const request = getRequestById(requestId);
  const eventDetails = request?.eventDetails || draft.eventDetails;
  const items = request?.items || draft.items;
  const quote = request?.quote || draftQuote;

  if (!request) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-semibold text-slate-950">Request not found</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This confirmation link does not match a saved catering request. Start a new request or open your request list.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white" onClick={() => navigate('/catering')}>
                Start new request
              </button>
              <Link to="/my-requests" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                View requests
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <CateringStepper currentStep={5} />

        <article className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Step 5</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Catering request created</h1>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Your request has been saved. You can review it in My Requests and continue to payment when Stripe is ready.
              </p>
            </div>
            <RequestStatusBadge status={request.status} />
          </div>
        </article>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <CateringSummaryCard eventDetails={eventDetails} items={items} />
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Request details</p>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <dt>Request ID</dt>
                  <dd className="font-medium text-slate-900">{request.requestId}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Submitted</dt>
                  <dd className="font-medium text-slate-900">{new Date(request.submittedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </div>

          <QuoteSummaryCard
            quote={quote}
            title="Estimated quote"
            primaryActionLabel="Go to my requests"
            onPrimaryAction={() => navigate('/my-requests')}
            secondaryActionLabel="Open payment"
            onSecondaryAction={() => navigate(`/my-requests/${request.requestId}/payment`)}
          />
        </div>
      </section>
    </main>
  );
}
