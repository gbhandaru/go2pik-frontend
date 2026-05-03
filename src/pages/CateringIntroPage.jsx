import { Link, useNavigate } from 'react-router-dom';
import cateringEntryImage from '../assets/catering_entry.png';

const valueProps = [
  {
    title: 'Multiple Restaurants',
    copy: 'Combine dishes from several local spots into one coordinated catering request.',
  },
  {
    title: 'Customizable Menu',
    copy: 'Adjust the menu to match your guest count, tastes, and event style.',
  },
  {
    title: 'On-time Delivery',
    copy: 'We keep timing tight so food arrives when your event needs it.',
  },
];

const howItWorksSteps = [
  'Tell us your event',
  'Share your menu',
  'We source restaurants',
  'Review & approve quote',
  'Pickup or delivery',
];

const trustPoints = [
  'No hidden fees',
  'Pickup-only',
  'Trusted restaurants',
  'Support',
];

export default function CateringIntroPage() {
  const navigate = useNavigate();

  const handlePlanParty = () => {
    navigate('/catering/event-details');
  };

  const handleSeeHowItWorks = () => {
    const target = document.getElementById('how-it-works');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[2.25rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="grid gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-100">
                <span aria-hidden="true">✦</span>
                Catering & party orders
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Planning a party? We&apos;ve got you covered!
              </h1>

              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                Order from multiple restaurants with one simple request
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePlanParty}
                  className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                >
                  Plan Your Party
                </button>
                <button
                  type="button"
                  onClick={handleSeeHowItWorks}
                  className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-white px-6 py-3.5 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                >
                  See How It Works
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">
                    ✓
                  </span>
                  Pickup-only. No delivery hassle. No hidden fees.
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-violet-200/60 via-transparent to-fuchsia-200/60 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-2xl shadow-slate-950/10">
                <img
                  src={cateringEntryImage}
                  alt="Catering spread with multiple dishes arranged for a party"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-4 bottom-4 rounded-[1.5rem] border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur sm:inset-x-6 sm:bottom-6 sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <PartyIcon />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-950">Perfect for any occasion</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Birthdays, anniversaries, get-togethers, office events, festivals, and more.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {valueProps.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <ValueIcon />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </section>

        <section id="how-it-works" className="mt-8 rounded-[2.25rem] border border-slate-200 bg-white px-5 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:px-8 lg:px-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-700">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Simple steps to plan your perfect event
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-5">
            {howItWorksSteps.map((step, index) => (
              <article
                key={step}
                className="rounded-[1.5rem] border border-violet-100 bg-gradient-to-b from-white to-violet-50 p-5 text-center"
              >
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-950 sm:text-base">{step}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {index === 0 && 'Share event details, date, time, location, and guest count.'}
                  {index === 1 && 'Upload a list or add items manually.'}
                  {index === 2 && 'We coordinate restaurants that can fulfill the request.'}
                  {index === 3 && 'Review the quote and confirm the request.'}
                  {index === 4 && 'Choose pickup or delivery based on the event.'}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-emerald-50/70 px-5 py-6 sm:px-8">
          <div className="grid gap-4 md:grid-cols-4 md:items-center">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-emerald-100" aria-hidden="true">
                  <TrustIcon />
                </span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 flex justify-center pb-2">
          <Link to="/" className="text-sm font-medium text-slate-500 transition hover:text-violet-700">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}

function ValueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm2.75-.75a.75.75 0 0 0-.75.75v10.5c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75V6.75a.75.75 0 0 0-.75-.75H5.75Zm1.5 3.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm4.75-.5h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Zm-4.75 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm4.75-.5h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Zm-4.75 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm4.75-.5h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Z" />
    </svg>
  );
}

function TrustIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M12 2.75 20 6.5v5.2c0 4.8-3.25 9.3-8 9.55-4.75-.25-8-4.75-8-9.55V6.5l8-3.75Zm0 2.18L6 7.74v3.96c0 3.74 2.4 7.58 6 7.82 3.6-.24 6-4.08 6-7.82V7.74l-6-2.81Zm-1.05 9.57 4.24-4.24 1.06 1.06-5.3 5.3-2.74-2.74 1.06-1.06 1.68 1.68Z" />
    </svg>
  );
}

function PartyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M12 2a1 1 0 0 1 1 1v2.1l1.67-1.1a1 1 0 1 1 1.1 1.67L14 6.83l1.84.1a1 1 0 0 1-.1 2L14 8.83l1.1 1.67a1 1 0 0 1-1.67 1.1L12 9.9V21a1 1 0 1 1-2 0V9.9l-1.43 1.8a1 1 0 1 1-1.57-1.24L8.8 8.83l-1.84-.1a1 1 0 0 1 .1-2L8.8 6.83 7.3 5.67a1 1 0 1 1 1.1-1.67L10 5.1V3a1 1 0 0 1 1-1Zm7.8 13.4 1.1.1a1 1 0 0 1 0 2l-1.1.1.8.84a1 1 0 1 1-1.44 1.38l-.8-.84-.1 1.1a1 1 0 0 1-2 0l-.1-1.1-.84.8a1 1 0 1 1-1.38-1.44l.84-.8-1.1-.1a1 1 0 0 1 0-2l1.1-.1-.8-.84a1 1 0 1 1 1.44-1.38l.8.84.1-1.1a1 1 0 0 1 2 0l.1 1.1.84-.8a1 1 0 1 1 1.38 1.44l-.84.8Z" />
    </svg>
  );
}
