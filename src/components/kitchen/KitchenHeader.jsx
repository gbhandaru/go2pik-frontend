import { Link } from 'react-router-dom';

export default function KitchenHeader({
  restaurantName = 'Go2Pik Kitchen',
  title = 'Kitchen Dashboard',
  subtitle,
  children,
  onLogout,
}) {
  return (
    <header className="kitchen-header card">
      <div className="kitchen-header__text">
        {restaurantName && <p className="kitchen-header__eyebrow">{restaurantName}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="kitchen-header__subtitle">{subtitle}</p>}
      </div>
      {(children || onLogout) ? (
        <div className="kitchen-header__actions">
          <Link className="kitchen-icon-btn kitchen-icon-btn--link" to="/kitchen/users/new" aria-label="Create restaurant user">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7v-1a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v1h-2v-1a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3v1Zm11-10V8h-2V5h-2v3h-2v2h2v3h2v-3Z" />
            </svg>
          </Link>
          {children}
          {onLogout ? (
            <button type="button" className="kitchen-icon-btn" onClick={onLogout} aria-label="Logout">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm9-13H12V2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7v-2h7V4Z" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
