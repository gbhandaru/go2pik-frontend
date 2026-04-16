import { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';

export default function App() {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let timeoutId = null;

    const showBanner = (event) => {
      const message = event?.detail?.message;
      if (!message) {
        return;
      }

      setBanner({ message, kind: event.type === 'go2pik:auth-expired' ? 'error' : 'success' });
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        setBanner(null);
      }, 3500);
    };

    window.addEventListener('go2pik:auth-expired', showBanner);
    window.addEventListener('go2pik:auth-renewed', showBanner);

    return () => {
      window.removeEventListener('go2pik:auth-expired', showBanner);
      window.removeEventListener('go2pik:auth-renewed', showBanner);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <AuthProvider>
      {banner ? (
        <div className={`auth-banner auth-banner--${banner.kind}`} role="status" aria-live="polite">
          {banner.message}
        </div>
      ) : null}
      <AppRoutes />
    </AuthProvider>
  );
}
