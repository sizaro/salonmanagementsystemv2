// src/components/common/Navbar.jsx
import React, { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Modal from "../../components/Modal.jsx";
import LoginForm from "../../components/auth/login.jsx";
import UserForm from "../../components/UserForm.jsx";
import { useData } from "../../context/DataContext.jsx";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [accountOptions, setAccountOptions] = useState(false);

  const { loginUser, createUser, checkAuth } = useData();
  const navigate = useNavigate();

  const accountRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOptions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (loginOpen || registerOpen) {
      setAccountOptions(false);
    }
  }, [loginOpen, registerOpen]);

  // -------------------
  // LOGIN
  // -------------------
  const handleLogin = async ({ email, password }) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await loginUser({ email, password });
      await checkAuth();
      setLoginOpen(false);

      if (res.role === "owner") navigate("/owner");
      else if (res.role === "manager") navigate("/manager");
      else if (res.role === "employee") navigate("/employee");
      else if (res.role === "customer") navigate("/customer");
      else navigate("/");
    } catch (err) {
      setLoginError(err?.response?.data?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  // -------------------
  // REGISTER
  // -------------------
  const handleCustomerRegister = async (formData) => {
    try {
      await createUser(formData);
      setRegisterOpen(false);
      setLoginOpen(true);
    } catch (err) {
      alert("Account creation failed");
    }
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <NavLink to="/" className="text-2xl font-bold text-blue-700">
          Beauty Parlour & Spa
        </NavLink>

        {/* Hamburger Mobile */}
        <button
          className="sm:hidden text-blue-700 text-2xl"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>

        <div
          className={`${
            menuOpen ? "block" : "hidden"
          } absolute sm:static top-16 left-0 w-full sm:w-auto bg-white sm:flex sm:space-x-6 shadow sm:shadow-none`}
        >
          {/* NAV LINKS */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `block px-2 py-2 rounded-md font-medium transition ${
                isActive
                  ? "text-blue-700 bg-blue-100 shadow-sm"
                  : "text-gray-700 hover:text-blue-600"
              }`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              `block px-2 py-2 rounded-md font-medium transition ${
                isActive
                  ? "text-blue-700 bg-blue-100 shadow-sm"
                  : "text-gray-700 hover:text-blue-600"
              }`
            }
          >
            About
          </NavLink>

          <NavLink
            to="/services"
            className={({ isActive }) =>
              `block px-2 py-2 rounded-md font-medium transition ${
                isActive
                  ? "text-blue-700 bg-blue-100 shadow-sm"
                  : "text-gray-700 hover:text-blue-600"
              }`
            }
          >
            Services
          </NavLink>

          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `block px-2 py-2 rounded-md font-medium transition ${
                isActive
                  ? "text-blue-700 bg-blue-100 shadow-sm"
                  : "text-gray-700 hover:text-blue-600"
              }`
            }
          >
            Contact
          </NavLink>

          {/* ----------------------------- */}
          {/* ACCOUNT DROPDOWN (with outside close) */}
          {/* ----------------------------- */}
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setAccountOptions(!accountOptions)}
              className="block bg-blue-600 text-white mx-4 my-2 px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              Account
            </button>

            {accountOptions && (
              <div className="absolute left-0 w-40 bg-white shadow rounded">
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  onClick={() => setLoginOpen(true)}
                >
                  Login
                </button>
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  onClick={() => setRegisterOpen(true)}
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LOGIN MODAL */}
      <Modal isOpen={loginOpen} onClose={() => setLoginOpen(false)}>
        <LoginForm
          onSubmit={handleLogin}
          onCancel={() => setLoginOpen(false)}
          loading={loading}
          error={loginError}
        />
      </Modal>

      {/* REGISTER MODAL */}
      <Modal isOpen={registerOpen} onClose={() => setRegisterOpen(false)}>
        <UserForm
          role="customer"
          onSubmit={handleCustomerRegister}
          onClose={() => setRegisterOpen(false)}
        />
      </Modal>
    </nav>
  );
}
