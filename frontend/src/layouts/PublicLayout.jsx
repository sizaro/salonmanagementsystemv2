import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import Navbar from "../components/common/Navbar.jsx";
import Footer from "../components/common/Footer.jsx";

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    AOS.init({ duration: 750, easing: "ease-out-cubic", once: true, offset: 72 });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => AOS.refreshHard());
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--salon-cream)] text-[var(--salon-ink)]">
      <Navbar />
      <main className="overflow-hidden"><Outlet /></main>
      <Footer />
    </div>
  );
}
