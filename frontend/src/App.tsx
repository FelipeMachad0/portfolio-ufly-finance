import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authContext';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { Categories } from './pages/Categories';
import { NotFound } from './pages/NotFound';
import { LoadingSpinner } from './components/common/LoadingSpinner';

const Transactions = lazy(() => import('./pages/Transactions').then((m) => ({ default: m.Transactions })));
const Budgets = lazy(() => import('./pages/Budgets').then((m) => ({ default: m.Budgets })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })));
const DRE = lazy(() => import('./pages/DRE').then((m) => ({ default: m.DRE })));
const Fornecedores = lazy(() => import('./pages/Fornecedores').then((m) => ({ default: m.Fornecedores })));
const CentrosCusto = lazy(() => import('./pages/CentrosCusto').then((m) => ({ default: m.CentrosCusto })));
const Clientes = lazy(() => import('./pages/Clientes').then((m) => ({ default: m.Clientes })));
const Projetos = lazy(() => import('./pages/Projetos').then((m) => ({ default: m.Projetos })));

function PrivateRoute({ children }: { children: ReactElement }) {
  const { token, autenticando } = useAuth();
  if (token) return children;
  // Volta do SSO: a Microsoft autenticou e a troca pelo JWT interno está em
  // curso. Mandar para /login aqui é o que fazia a pessoa voltar para a tela de
  // login logo depois de escolher a conta.
  if (autenticando) return <LoadingSpinner />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/accounts" element={<PrivateRoute><Accounts /></PrivateRoute>} />
        <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
        <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
        <Route path="/budgets" element={<PrivateRoute><Budgets /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
        <Route path="/dre" element={<PrivateRoute><DRE /></PrivateRoute>} />
        <Route path="/fornecedores" element={<PrivateRoute><Fornecedores /></PrivateRoute>} />
        <Route path="/centros-custo" element={<PrivateRoute><CentrosCusto /></PrivateRoute>} />
        <Route path="/clientes" element={<PrivateRoute><Clientes /></PrivateRoute>} />
        <Route path="/projetos" element={<PrivateRoute><Projetos /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
