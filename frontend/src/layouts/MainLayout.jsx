import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F5F5F1] text-[#1F2521]">
      <Navbar />

      <main>{children}</main>

      <Footer />
    </div>
  );
}

export default MainLayout;