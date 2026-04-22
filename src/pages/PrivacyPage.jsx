import { Link } from 'react-router-dom';

const policyPoints = [
  'We do not sell or share mobile numbers for marketing purposes.',
  'We use SMS to support order updates, pickup coordination, and order review.',
  'Message frequency may vary depending on your orders and account activity.',
  'Message and data rates may apply from your mobile carrier.',
];

export default function PrivacyPage() {
  return (
    <main className="page-section legal-page">
      <article className="card legal-card">
        <p className="eyebrow">Privacy Policy</p>
        <h1>How we handle your information</h1>
        <p className="legal-lede">
          This summary explains how Go2Pik uses your phone number and messaging details when you place pickup orders.
        </p>
        <ul className="legal-list">
          {policyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="legal-note">
          We only use your information to help complete your order, send relevant order messages, and support your account.
        </p>
        <div className="legal-actions">
          <Link className="primary-btn" to="/">
            Back to home
          </Link>
          <Link className="text-link" to="/terms">
            View Terms &amp; Conditions
          </Link>
        </div>
      </article>
    </main>
  );
}
