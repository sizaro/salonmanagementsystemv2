// src/components/Footer.jsx
import React from "react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-6 mt-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center">
        <p>&copy; {new Date().getFullYear()} Salehish Beauty Parlour & Spa. All rights reserved.</p>
        <div className="space-x-4 mt-3 sm:mt-0">
          <a href="#" className="hover:text-white">Facebook</a>
          <a href="#" className="hover:text-white">Instagram</a>
          <a href="#" className="hover:text-white">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}
