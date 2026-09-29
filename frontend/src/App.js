import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import GridStudio from "@/pages/GridStudio";
import GridOutput from "@/pages/GridOutput";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GridStudio />} />
          <Route path="/output" element={<GridOutput />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
