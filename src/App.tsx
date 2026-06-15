import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/Layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import DataManagement from "@/pages/DataManagement";
import AnomalyReview from "@/pages/AnomalyReview";
import CockpitPage from "@/pages/CockpitPage";
import AcceptanceCenter from "@/pages/AcceptanceCenter";

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="/anomaly" element={<AnomalyReview />} />
          <Route path="/cockpit" element={<CockpitPage />} />
          <Route path="/acceptance" element={<AcceptanceCenter />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}
