import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import { useData } from "../../context/DataContext";

export default function Home() {
  const { serviceDefinitions = [], fetchServiceDefinitions } = useData();

  useEffect(() => {
    fetchServiceDefinitions();
  }, []);

  // Take only the first 4 services
  const popularServices = serviceDefinitions.slice(0, 4);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 text-white text-center py-24">
        <h1 className="md:text-5xl font-bold mb-4 text-3xl">
          Welcome Beauty Parlour & Spa
        </h1>
        <h3 className="md:text-3xl font-bold mb-2 text-2xl">
          The Core of Beauty Parlour
        </h3>
        <p className="text-lg mb-6 max-w-2xl mx-auto">
          Redefining beauty and confidence through professional styling,
          creativity, and care — your transformation starts here.
        </p>
        <Link
          to="/services"
          className="bg-white text-blue-700 px-6 py-3 font-semibold rounded-lg shadow hover:bg-gray-100"
        >
          Explore Our Services
        </Link>
      </header>

      {/* Services Preview */}
      <section className="py-16 px-6 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8 text-gray-800">Our Popular Services</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularServices.map((service, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition"
            >
              <div className="h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.service_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "Image Coming Soon"
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {service.service_name}
                </h3>
                <p className="text-gray-600 text-sm">{service.description}</p>
                <p className="text-gray-800 font-bold mt-2">
                  UGX {service.service_amount}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            to="/services"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            See More Services
          </Link>
        </div>
      </section>

      {/* About Teaser */}
      <section className="bg-white py-16 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4 text-gray-800">About Us</h2>
          <p className="text-gray-600 mb-6">
            At Beauty Parlour & Spa, we combine passion, precision, and creativity to bring out your best look.
            Whether it’s a simple trim or a premium treatment, our professional team ensures you leave looking
            and feeling amazing.
          </p>
          <Link
            to="/about"
            className="text-blue-700 font-medium hover:underline"
          >
            Learn more about us →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
