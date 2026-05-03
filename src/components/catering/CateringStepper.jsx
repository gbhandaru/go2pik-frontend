const defaultSteps = [
  'Event details',
  'Items',
  'Review items',
  'Final review',
  'Confirmation',
];

export default function CateringStepper({ currentStep = 1, steps = defaultSteps }) {
  const stepIndex = Math.min(Math.max(Number(currentStep) || 1, 1), steps.length);

  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {steps.map((step, index) => {
        const position = index + 1;
        const isActive = position === stepIndex;
        const isCompleted = position < stepIndex;

        return (
          <li
            key={step}
            className={[
              'rounded-2xl border px-4 py-3 text-sm transition',
              isActive ? 'border-violet-500 bg-violet-50 text-violet-900 shadow-sm' : 'border-slate-200 bg-white text-slate-600',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <span
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  isCompleted ? 'bg-violet-600 text-white' : isActive ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500',
                ].join(' ')}
              >
                {isCompleted ? <CheckIcon /> : position}
              </span>
              <div>
                <p className="font-medium text-slate-900">{step}</p>
                <p className="text-xs text-slate-500">{isCompleted ? 'Completed' : isActive ? 'In progress' : 'Upcoming'}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]">
      <path d="M4 10.5 8 14.5 16 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
