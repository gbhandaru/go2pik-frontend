export default function KitchenHeader({
  restaurantName = 'Go2Pik Kitchen',
  title = 'Kitchen Dashboard',
  subtitle,
  children,
}) {
  return (
    <header className="kitchen-header card">
      <div className="kitchen-header__text">
        {restaurantName && <p className="kitchen-header__eyebrow">{restaurantName}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="kitchen-header__subtitle">{subtitle}</p>}
      </div>
      {children ? <div className="kitchen-header__actions">{children}</div> : null}
    </header>
  );
}
