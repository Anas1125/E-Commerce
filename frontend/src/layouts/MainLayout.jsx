import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

function MainLayout() {
  return (
    <div
      id="page-top"
      className="min-h-screen bg-[#F5F5F1] text-[#1F2521]"
    >
      <SEO />

      <Navbar />

      <main>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default MainLayout;