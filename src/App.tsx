import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAppStore } from "./store/useAppStore";
import { profileManager } from "./lib/profileManager";
import { DiagScanPage } from "./pages/DiagScanPage";
import { ChallengePage } from "./pages/ChallengePage";
import { GrowthPage } from "./pages/GrowthPage";
import { MilestonePage } from "./pages/MilestonePage";
import { HeatmapPage } from "./pages/HeatmapPage";
import { ReaderPage } from "./pages/ReaderPage";
import { CoachChat } from "./components/CoachChat";
import { NavBar } from "./components/NavBar";

function App() {
  const { profile, refreshProfile } = useAppStore();

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const hasProfile = !!profile;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0f] text-[#f5f5f7]">
        {hasProfile && <NavBar />}
        <Routes>
          <Route path="/scan" element={hasProfile ? <Navigate to="/" /> : <DiagScanPage />} />
          <Route path="/" element={hasProfile ? <ChallengePage /> : <Navigate to="/scan" />} />
          <Route path="/growth" element={hasProfile ? <GrowthPage /> : <Navigate to="/scan" />} />
          <Route path="/milestones" element={hasProfile ? <MilestonePage /> : <Navigate to="/scan" />} />
          <Route path="/heatmap" element={hasProfile ? <HeatmapPage /> : <Navigate to="/scan" />} />
          <Route path="/read/:id" element={hasProfile ? <ReaderPage /> : <Navigate to="/scan" />} />
          <Route path="*" element={<Navigate to={hasProfile ? "/" : "/scan"} />} />
        </Routes>
        {hasProfile && <CoachChat />}
      </div>
    </BrowserRouter>
  );
}

export default App;
