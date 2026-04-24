export default function ContactSupportModal({
  email,
  mailtoHref,
  onClose,
  onCopyEmail,
  title = 'Need help?',
  description = 'Use the email below to reach the Go2Pik support team.',
}) {
  if (!email || !mailtoHref) {
    return null;
  }

  return (
    <div className="support-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="support-modal__close" onClick={onClose} aria-label="Close contact modal">
          ×
        </button>
        <p className="support-modal__eyebrow">Contact</p>
        <h2 id="support-modal-title">{title}</h2>
        <p className="support-modal__copy">{description}</p>
        <div className="support-modal__email-row">
          <strong>{email}</strong>
          <button type="button" className="support-modal__copy-btn" onClick={onCopyEmail}>
            Copy
          </button>
        </div>
        <div className="support-modal__actions">
          <a className="primary-btn support-modal__primary" href={mailtoHref}>
            Email Support
          </a>
          <button type="button" className="primary-btn secondary support-modal__secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
