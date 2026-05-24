import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import CookieBanner from "./components/CookieBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AccountsPage from "./pages/AccountsPage";
import ListingsPage from "./pages/ListingsPage";
import MessagesPage from "./pages/MessagesPage";
import BillingPage from "./pages/BillingPage";
import AdminPage from "./pages/AdminPage";
import SettingsPage from "./pages/SettingsPage";
import ImpressumPage from "./pages/ImpressumPage";
import DatenschutzPage from "./pages/DatenschutzPage";
import AgbPage from "./pages/AgbPage";
import LandingPage from "./pages/LandingPage";
import AutoReplyPage from "./pages/AutoReplyPage";
import WatchesPage from "./pages/WatchesPage";
import AiCreatePage from "./pages/AiCreatePage";
import NotFoundPage from "./pages/NotFoundPage";
import AutoBumpPage from "./pages/AutoBumpPage";
import NotificationsPage from "./pages/NotificationsPage";
import SupportPage from "./pages/SupportPage";

// Root route: show LandingPage to anonymous visitors, send signed-in
// users straight to their dashboard. While the auth check is in flight
// we render LandingPage so the public marketing page is the visible
// fallback (cheaper than a spinner on the most common cold-load path).
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LandingPage />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Public legal pages */}
            <Route path="/impressum" element={<ImpressumPage />} />
            <Route path="/datenschutz" element={<DatenschutzPage />} />
            <Route path="/agb" element={<AgbPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/auto-replies" element={<AutoReplyPage />} />
                <Route path="/watches" element={<WatchesPage />} />
                <Route path="/ai-create" element={<AiCreatePage />} />
                <Route path="/auto-bump" element={<AutoBumpPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/support" element={<SupportPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
