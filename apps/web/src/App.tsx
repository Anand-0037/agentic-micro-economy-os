import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DecisionsPage } from "./pages/DecisionsPage";
import { EvalPage } from "./pages/EvalPage";
import { LandingPage } from "./pages/LandingPage";
import { ReplayPage } from "./pages/ReplayPage";
import { SentryExamplePage } from "./pages/SentryExamplePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sentry-example-page" element={<SentryExamplePage />} />
      <Route path="/app" element={<AppLayout basePath="/app" />}>
        <Route index element={<DashboardPage />} />
        <Route path="decisions" element={<DecisionsPage />} />
        <Route path="activity" element={<Navigate replace to="/app/decisions" />} />
        <Route path="policy" element={<Navigate replace to="/app" />} />
        <Route path="risk" element={<Navigate replace to="/app" />} />
        <Route path="settings" element={<Navigate replace to="/app?settings=1" />} />
        <Route path="eval" element={<EvalPage />} />
        <Route path="replay" element={<ReplayPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
