import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ViewReaderPage } from "./pages/ViewReaderPage";
import { HeatmapPage } from "./pages/HeatmapPage";
import { CocoonScanPage } from "./pages/CocoonScanPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/scan" element={<CocoonScanPage />} />
        <Route path="/read/:id" element={<ViewReaderPage />} />
        <Route path="/heatmap" element={<HeatmapPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
