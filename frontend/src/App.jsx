import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoadingSpinner from "./components/LoadingSpinner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import CookieBanner from "./components/CookieBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const ListingsPage = lazy(() => import("./pages/ListingsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ImpressumPage = lazy(() => import("./pages/ImpressumPage"));
const DatenschutzPage = lazy(() => import("./pages/DatenschutzPage"));
const AgbPage = lazy(() => import("./pages/AgbPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AutoReplyPage = lazy(() => import("./pages/AutoReplyPage"));
const WatchesPage = lazy(() => import("./pages/WatchesPage"));
const AiCreatePage = lazy(() => import("./pages/AiCreatePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AutoBumpPage = lazy(() => import("./pages/AutoBumpPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));

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
          <Suspense fallback={<LoadingSpinner />}>
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
          </Suspense>
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
