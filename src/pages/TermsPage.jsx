import { Link } from 'react-router-dom';

const termsPoints = [
  'By providing your phone number, you agree to receive SMS messages related to your order and account.',
  'You can reply STOP at any time to opt out of future text messages.',
  'You can reply HELP for assistance with messaging or your order.',
  '* Messaging frequency may vary based on order activity and account updates. Message and data rates may apply.',
];

export default function TermsPage() {
  return (
    <main className="page-section legal-page">
      <article className="card legal-card">
        <p className="eyebrow">Terms &amp; Conditions</p>
        <h1>SMS consent and messaging terms</h1>
        <p className="legal-lede">
          Go2Pik is a service provided by EHA Technologies. These Terms govern your use of the Go2Pik platform.
        </p>
        <ul className="legal-list">
          {termsPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="legal-note">
          Message and data rates may apply.
        </p>
        <p className="legal-note">
          Consent to receive SMS messages is not a condition of purchase.
        </p>
        <div className="legal-actions">
          <Link className="primary-btn" to="/">
            Back to home
          </Link>
          <Link className="text-link" to="/privacy">
            View Privacy Policy
          </Link>
        </div>
      </article>
    </main>
  );
}
