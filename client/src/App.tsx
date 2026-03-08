import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserCheck } from "@/components/BrowserCheck";
import { SetupPage } from "@/pages/SetupPage";
import { InterviewPage } from "@/pages/InterviewPage";
import { ResultsPage } from "@/pages/ResultsPage";

export function App() {
  return (
    <ErrorBoundary>
      <BrowserCheck>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<SetupPage />} />
              <Route path="/interview/:id" element={<InterviewPage />} />
              <Route path="/results/:id" element={<ResultsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BrowserCheck>
    </ErrorBoundary>
  );
}
