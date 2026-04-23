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
        <h1>SMS Privacy and Consent</h1>
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
        <section className="legal-section">
          <h2>SMS Consent and Mobile Information</h2>
          <p>
            When you provide your mobile phone number and opt in to receive text messages from Go2Pik, we use your number only to send transactional messages related to your orders, such as order confirmations, order status updates (accepted, preparing, ready for pickup), and pickup notifications.
          </p>
          <p>
            Mobile opt-in data and consent will not be shared with any third parties or affiliates for marketing or promotional purposes.
          </p>
          <p>
            Text messaging originator opt-in data and consent will not be shared with any third parties, excluding aggregators and service providers required to deliver the SMS messages.
          </p>
          <p>
            You can opt out of SMS messages at any time by replying STOP. For help, reply HELP.
          </p>
        </section>
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
