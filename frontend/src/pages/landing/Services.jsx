import React, { useEffect } from "react";
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import { useData } from "../../context/DataContext";

export default function Services() {
    const staticBaseUrl =
  import.meta.env.MODE === "development"
    ? "http://localhost:5500"
    : "https://salonmanagementsystemv2-ru0i.onrender.com/";
  // Service Data
  const { serviceDefinitions = [], fetchServiceDefinitions } = useData();

  useEffect(() => {
    fetchServiceDefinitions();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 px-6 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
          Our Full Service Menu
        </h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {serviceDefinitions.map((service, i) => (
            <div
              key={i}
              className="bg-white shadow rounded-xl p-6 hover:shadow-lg transition flex flex-col"
            >
              <div className="h-40 bg-gray-200 rounded-lg mb-4 flex items-center justify-center text-gray-500 overflow-hidden">
                {service.image_url ? (
                  <img
                    src={`${staticBaseUrl}${service.image_url}` || `image`}
                    alt={service.service_name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  "Image Coming Soon"
                )}
              </div>
              <h3 className="text-xl font-semibold text-blue-700 mb-2">
                {service.service_name}
              </h3>
              <p className="text-gray-700 mb-2">{service.description}</p>
              <p className="text-gray-800 font-bold text-lg">
                UGX {service.service_amount}
              </p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
