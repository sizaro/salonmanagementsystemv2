import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Scissors, Sparkles, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Modal from "../Modal.jsx";
import LoginForm from "../auth/login.jsx";
import ForgotPasswordForm from "../auth/ForgotPasswordForm.jsx";
import UserForm from "../UserForm.jsx";
import ToastModal from "../ToastModal.jsx";
import { useData } from "../../context/DataContext.jsx";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/salon-life", label: "Salon Life" },
  { to: "/events-news", label: "News" },
  { to: "/contact", label: "Contact" },
];

const linkClass = ({ isActive }) => `relative py-2 text-sm font-semibold transition ${isActive ? "text-[var(--salon-copper)]" : "text-slate-700 hover:text-[var(--salon-copper)]"}`;

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authForm, setAuthForm] = useState("login");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [registrationCountdown, setRegistrationCountdown] = useState(null);
  const accountRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { loginUser, createUser, checkAuth, forgotPassword } = useData();

  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [location.pathname]);
  useEffect(() => {
    const close = (event) => { if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);
  useEffect(() => {
    if (registrationCountdown === null) return undefined;
    if (registrationCountdown <= 0) {
      setRegistrationCountdown(null);
      setAuthForm("login");
      setLoginOpen(true);
      return undefined;
    }
    const timer = window.setTimeout(
      () => setRegistrationCountdown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [registrationCountdown]);

  const handleLogin = async ({ email, password }) => {
    setLoading(true); setLoginError(null);
    try {
      const response = await loginUser({ email, password });
      await checkAuth();
      setLoginOpen(false);
      const routes = { owner: "/owner", manager: "/manager", employee: "/employee", customer: "/customer", cashier: "/cashier" };
      navigate(routes[response.role] || "/");
    } catch (error) {
      setLoginError(error?.response?.data?.message || "Sign in failed. Check your details and try again.");
    } finally { setLoading(false); }
  };

  const register = async (formData) => {
    try {
      await createUser(formData);
      setRegisterOpen(false);
      setRegistrationCountdown(5);
    }
    catch (error) {
      setToast({ message: error?.response?.data?.error || "Account creation failed. Please try again.", type: "error" });
      throw error;
    }
  };

  const submitForgotPassword = async (email) => {
    setLoading(true);
    const response = await forgotPassword(email);
    setLoading(false);
    setToast({ message: response.success ? `Reset link sent to ${email}` : response.message || "Unable to send reset link", type: response.success ? "success" : "error" });
    if (response.success) setTimeout(() => { setLoginOpen(false); setAuthForm("login"); }, 3500);
  };

  const openLogin = () => { setAuthForm("login"); setLoginError(null); setMenuOpen(false); setLoginOpen(true); };
  const openRegister = () => { setMenuOpen(false); setRegisterOpen(true); };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-stone-200/80 bg-[var(--salon-cream)]/95 backdrop-blur-xl">
        <div className="salon-container flex h-20 items-center justify-between gap-5">
          <NavLink to="/" className="group flex min-w-0 items-center gap-3" aria-label="Salehish home">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--salon-ink)] text-amber-300 transition group-hover:rotate-6"><Scissors size={20} /></span>
            <span className="min-w-0"><span className="block truncate font-serif text-xl font-semibold text-[var(--salon-ink)]">Salehish</span><span className="block truncate text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--salon-copper)]">Beauty Parlour & Spa</span></span>
          </NavLink>

          <div className="hidden items-center gap-5 xl:flex">
            {links.map((link) => <NavLink key={link.to} {...link} className={linkClass}>{link.label}</NavLink>)}
          </div>

          <div className="hidden items-center gap-3 xl:flex" ref={accountRef}>
            <NavLink to="/contact" className="salon-button-secondary">How to book</NavLink>
            <div className="relative"><button type="button" onClick={() => setAccountOpen((value) => !value)} className="salon-button-primary">Portal <ChevronDown size={16} className={`transition ${accountOpen ? "rotate-180" : ""}`} /></button>{accountOpen && <div className="absolute right-0 mt-3 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl"><button onClick={openLogin} className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-stone-100">Sign in</button><button onClick={openRegister} className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-stone-100">Create customer account</button></div>}</div>
          </div>

          <button type="button" onClick={() => setMenuOpen(true)} className="grid h-11 w-11 place-items-center rounded-full border border-stone-300 text-[var(--salon-ink)] xl:hidden" aria-label="Open navigation"><Menu size={21} /></button>
        </div>
      </nav>

      <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className={`fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-sm transition xl:hidden ${menuOpen ? "visible opacity-100" : "invisible opacity-0"}`} />
      <aside className={`fixed inset-y-0 right-0 z-[70] flex w-[min(88vw,390px)] flex-col overflow-y-auto bg-[var(--salon-cream)] p-6 shadow-2xl transition-transform duration-500 xl:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Sparkles className="text-[var(--salon-copper)]" /><span className="font-serif text-xl font-semibold">Explore Salehish</span></div><button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border" aria-label="Close navigation"><X size={19} /></button></div>
        <div className="mt-12 flex flex-col gap-2">{links.map((link, index) => <NavLink key={link.to} {...link} className={({ isActive }) => `rounded-2xl px-5 py-4 text-lg font-semibold transition ${isActive ? "bg-[var(--salon-ink)] text-white" : "hover:bg-stone-200/70"}`}><span className="mr-4 text-xs text-[var(--salon-copper)]">0{index + 1}</span>{link.label}</NavLink>)}</div>
        <div className="mt-auto grid gap-3"><button onClick={openLogin} className="salon-button-primary justify-center">Sign in to portal</button><button onClick={openRegister} className="salon-button-secondary justify-center">Create account</button><p className="text-center text-xs text-slate-500">Professional beauty, grooming and wellness in one welcoming space.</p></div>
      </aside>

      <Modal isOpen={loginOpen} onClose={() => setLoginOpen(false)}>{authForm === "login" ? <LoginForm onSubmit={handleLogin} onCancel={() => setLoginOpen(false)} loading={loading} error={loginError} onForgotPassword={() => setAuthForm("forgot")} /> : <ForgotPasswordForm onSubmit={submitForgotPassword} onCancel={() => setAuthForm("login")} loading={loading} message={null} error={null} />}</Modal>
      <Modal isOpen={registerOpen} onClose={() => setRegisterOpen(false)}><UserForm role="customer" onSubmit={register} onClose={() => setRegisterOpen(false)} /></Modal>
      <Modal isOpen={registrationCountdown !== null} onClose={() => {}}>
        <div className="mx-auto max-w-md p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</span>
          <h2 className="mt-5 font-serif text-2xl font-semibold text-[var(--salon-ink)]">Account created successfully</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Your customer account is ready. Redirecting you to sign in in {registrationCountdown} second{registrationCountdown === 1 ? "" : "s"}.
          </p>
          <button type="button" onClick={() => setRegistrationCountdown(0)} className="salon-button-primary mt-6 justify-center">
            Continue to sign in now
          </button>
        </div>
      </Modal>
      {toast.message && <ToastModal message={toast.message} type={toast.type} duration={5000} onClose={() => setToast({ message: "", type: toast.type })} />}
    </>
  );
}
