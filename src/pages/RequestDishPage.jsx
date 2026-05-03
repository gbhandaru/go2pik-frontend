import { Link } from 'react-router-dom';

export default function RequestDishPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <article className="w-full rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-700">Request a dish</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">We’ll turn this into a real request flow soon.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            This is a placeholder page for demand capture. The primary ordering flow stays intact while this new entry point is prepared.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/catering" className="inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500">
              Plan Your Party
            </Link>
            <Link to="/home" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700">
              Back to restaurants
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
