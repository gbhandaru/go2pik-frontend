import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';

const PUBLIC_AUTH_ROUTES = ['/login', '/signup', '/password-update', '/kitchen/login', '/kitchen/users/new'];

function isPublicAuthRoute(pathname) {
  return PUBLIC_AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function AuthBanner({ banner, onDismiss }) {
  const location = useLocation();

  useEffect(() => {
    if (isPublicAuthRoute(location.pathname)) {
      onDismiss();
    }
  }, [location.pathname, onDismiss]);

  if (!banner || isPublicAuthRoute(location.pathname)) {
    return null;
  }

  return (
    <div className={`auth-banner auth-banner--${banner.kind}`} role="status" aria-live="polite">
      {banner.message}
    </div>
  );
}

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
    <BrowserRouter>
      <AuthProvider>
        <AuthBanner banner={banner} onDismiss={() => setBanner(null)} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
