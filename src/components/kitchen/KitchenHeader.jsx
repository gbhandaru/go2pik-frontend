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
