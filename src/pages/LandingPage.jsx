import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <main className="page-section">
      <div className="page-header">
        <p>Meet Go2Pik</p>
        <h1>Fresh food, faster fulfillment.</h1>
        <p>
          Curated restaurant partners, one tap checkout, and live order tracking. Built on the
          same Vite + Firebase toolchain you used for foof-order-app.
        </p>
      </div>
      <div className="card-grid">
        <article className="card">
          <h2>Hungry customers</h2>
          <p>Explore hand-picked restaurants, customize your meal, and check out securely.</p>
          <Link className="primary-btn" to="/home">
            Browse restaurants
          </Link>
        </article>
        <article className="card">
          <h2>Restaurant partners</h2>
          <p>Use the same login as foof-order-app to view incoming orders in real time.</p>
          <Link className="secondary-btn primary-btn" to="/login">
            Sign in
          </Link>
        </article>
      </div>
    </main>
  );
}
