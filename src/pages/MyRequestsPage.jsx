import { Link, useNavigate } from 'react-router-dom';
import RequestStatusBadge from '../components/catering/RequestStatusBadge.jsx';
import { useCateringRequest } from '../context/CateringRequestContext.jsx';

export default function MyRequestsPage() {
  const navigate = useNavigate();
  const { requests } = useCateringRequest();

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Catering requests</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">My Requests</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">All created catering requests appear here because there is no backend integration yet.</p>
        </header>

        {requests.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-950">No requests yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Start a catering request to see it show up in this list.</p>
            <button type="button" className="mt-5 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white" onClick={() => navigate('/catering')}>
              Start catering request
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <article key={request.requestId} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-slate-950">{request.eventDetails.eventName || 'Untitled request'}</h2>
                      <RequestStatusBadge status={request.paymentStatus === 'paid' ? 'confirmed' : request.paymentStatus === 'pending' ? 'payment_pending' : request.status} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {request.eventDetails.eventDate || 'Date not set'} · {request.items.length} item{request.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to={`/my-requests/${request.requestId}`} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                      View request
                    </Link>
                    <Link to={`/my-requests/${request.requestId}/payment`} className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
                      Payment
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
