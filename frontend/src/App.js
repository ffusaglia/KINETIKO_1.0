import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Studio from "@/pages/Studio";
import Output from "@/pages/Output";
import GridStudio from "@/pages/GridStudio";
import GridOutput from "@/pages/GridOutput";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Studio />} />
          <Route path="/output" element={<Output />} />
          <Route path="/grid" element={<GridStudio />} />
          <Route path="/grid-output" element={<GridOutput />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
