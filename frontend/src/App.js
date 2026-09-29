import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Studio from "@/pages/Studio";
import Output from "@/pages/Output";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Studio />} />
          <Route path="/output" element={<Output />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
