import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserCheck } from "@/components/BrowserCheck";
import { ProtectedRoute, GuestRoute } from "@/components/ProtectedRoute";
import { SetupPage } from "@/pages/SetupPage";
import { InterviewPage } from "@/pages/InterviewPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";

export function App() {
  return (
    <ErrorBoundary>
      <BrowserCheck>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Guest routes (only for unauthenticated users) */}
              <Route
                element={<GuestRoute><Layout /></GuestRoute>}
              >
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Protected routes (require authentication) */}
              <Route
                element={<ProtectedRoute><Layout /></ProtectedRoute>}
              >
                <Route path="/" element={<SetupPage />} />
                <Route path="/interview/:id" element={<InterviewPage />} />
                <Route path="/results/:id" element={<ResultsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </BrowserCheck>
    </ErrorBoundary>
  );
}
