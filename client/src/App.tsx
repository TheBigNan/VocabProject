import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";
import ViewLists from "./pages/ViewLists";
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
          <Route path="/lists" element={<ViewLists />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
