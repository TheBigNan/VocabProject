import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";
import ViewMaterials from "./pages/ViewMaterials";
import FlashcardSetViewer from "./pages/FlashcardSetViewer";
import StudyTools from "./pages/StudyTools";
import Stats from "./pages/Stats";
import { recordVisit } from "./api";

export default function App() {
  useEffect(() => {
    if (!sessionStorage.getItem("wordwise-visit-recorded")) {
      sessionStorage.setItem("wordwise-visit-recorded", "1");
      recordVisit();
    }
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/materials" element={<ViewMaterials />} />
          <Route path="/materials/sets/:setId" element={<FlashcardSetViewer />} />
          <Route path="/lists" element={<Navigate to="/materials" replace />} />
          <Route path="/study" element={<StudyTools />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
