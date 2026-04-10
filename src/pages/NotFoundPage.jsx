import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="page-section">
      <div className="page-empty-state">
        <h1>Oops! Page not found</h1>
        <p>The link you followed may be broken or the page may have been removed.</p>
        <Link className="primary-btn" to="/home">
          Go back home
        </Link>
      </div>
    </main>
  );
}
