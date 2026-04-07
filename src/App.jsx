import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './hooks/useAuth.js';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
