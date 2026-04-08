import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
