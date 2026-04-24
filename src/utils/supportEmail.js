const SUPPORT_EMAIL = 'support@go2pik.com';

export function buildSupportMailtoHref({ email = SUPPORT_EMAIL, subject = '', body = '' } = {}) {
  const params = new URLSearchParams();
  if (subject) {
    params.set('subject', subject);
  }
  if (body) {
    params.set('body', body);
  }

  const query = params.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}
