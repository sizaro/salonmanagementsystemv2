// components/common/SidebarFooter.jsx
import { useData } from "../../context/DataContext.jsx";
import { useNavigate } from "react-router-dom";

const SidebarFooter = () => {
  const { logoutUser } = useData();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate("/");
  };

  return (
    <div className="mt-auto border-t border-white/10 p-4">
      <button
        onClick={handleLogout}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-semibold text-white transition hover:border-[var(--salon-gold)] hover:bg-[var(--salon-gold)] hover:text-[var(--salon-ink)]"
      >
        Logout
      </button>
    </div>
  );
};

export default SidebarFooter;
