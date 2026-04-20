export default function AsyncState({
  title,
  message,
  loading = false,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}) {
  return (
    <div className="page-empty-state" role={loading ? 'status' : 'alert'} aria-live="polite">
      {title ? <strong>{title}</strong> : null}
      {message ? <p className="muted">{message}</p> : null}
      {children}
      {loading ? <span className="muted">Loading…</span> : null}
      {onPrimaryAction ? (
        <button type="button" className="primary-btn" onClick={onPrimaryAction}>
          {primaryActionLabel || 'Try again'}
        </button>
      ) : null}
      {onSecondaryAction ? (
        <button type="button" className="primary-btn secondary" onClick={onSecondaryAction}>
          {secondaryActionLabel || 'Go back'}
        </button>
      ) : null}
    </div>
  );
}
