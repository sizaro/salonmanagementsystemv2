import React, { useEffect } from "react";
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import { useData } from "../../context/DataContext";

export default function Home() {

  const staticBaseUrl =
  import.meta.env.MODE === "development"
    ? "http://localhost:5500"
    : "https://salonmanagementsystemv2-ru0i.onrender.com";
  const { serviceDefinitions = [], fetchServiceDefinitions } = useData();

  useEffect(() => {
    fetchServiceDefinitions();
  }, []);

  const popularServices = serviceDefinitions.slice(0, 4);

  return (
    <div className="bg-gray-50 flex flex-col min-h-screen">
      <Navbar />

      {/* ================= HERO SECTION ================= */}
      <header className="relative w-full h-[80vh] overflow-hidden">
        <img
          src="/images/hero_image.jpg"
          alt="Hero Salon"
          className="w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 hidden md:flex flex-col justify-center items-center text-center text-white px-4" style={{ textShadow: "2px 2px 4px rgba(0, 102, 255, 0.7)" }}>
          <h1 className="text-2xl md:text-6xl font-bold mb-2">Beauty Parlour & Spa</h1> 
          <h3 className="md:text-3xl font-semibold mb-4 text-2xl">The Core of Beauty Parlour</h3>
          <h3 className=" mb-4 max-w-md mx-auto">
            To “Book Appointment” create an account or sign in if you already have one at the top.
          </h3>
          <h4 className="mt-4 bg-blue-600 px-6 py-3 rounded-lg shadow-lg font-semibold hover:bg-blue-700 transition">
            Prove Us
          </h4>
        </div>
      </header>

      <section className="py-16 px-6 max-w-7xl mx-auto text-center flex md:hidden">
        <div className="flex flex-col justify-center items-center text-center text-blue-600 px-4">
          <h1 className="text-2xl md:text-6xl font-bold mb-2">Beauty Parlour & Spa</h1>
          <h3 className="md:text-3xl font-semibold mb-4 text-2xl">The Core of Beauty Parlour</h3>
          <h3 className=" mb-4 max-w-md mx-auto">
            To “Book Appointment” create an account or sign in if you already have one at the top.
          </h3>
          <h4 className="mt-4 bg-blue-600 px-6 py-3 rounded-lg shadow-lg font-semibold hover:bg-blue-700 transition text-white">
            Prove Us
          </h4>
        </div>
      </section>

      {/* ================= POPULAR SERVICES ================= */}
      <section className="py-16 px-6 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8 text-gray-800">Our Popular Services</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularServices.map((service, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition"
            >
              <div className="h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
                <img
                  src={`${staticBaseUrl}${service.image_url}` || `image`}
                  alt={service.service_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">{service.service_name}</h3>
                <p className="text-gray-600 text-sm">{service.description}</p>
                <p className="text-gray-800 font-bold mt-2">UGX {service.service_amount}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
            See More Services
          </button>
        </div>
      </section>

      {/* ================= OUR WORK ================= */}
      
      <section className="py-16 bg-white">
  <div className="max-w-7xl mx-auto px-6">
    <h2 className="text-3xl font-bold mb-4 text-gray-800 text-center">Our Work</h2>
    <p className="text-gray-600 max-w-3xl mx-auto mb-10 text-center">
      We take pride in transforming our clients. From stylish haircuts to elegant nails, skincare, and children’s styling, we bring out the best in everyone.
    </p>

    <div className="grid sm:grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Hair Styling */}
      <div className="bg-gray-50 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
        <img
          src="/images/professional cuts.jpg"
          alt="Hair Styling"
          className="w-full h-64 object-cover rounded-t-xl"
        />
        <div className="p-4 text-center">
          <h3 className="text-xl font-semibold mb-2">Hair Cuts</h3>
          <p className="text-gray-600 text-sm">
            Elegant haircuts and styling for men, women, and children. Our professionals create the perfect look for every occasion.
          </p>
        </div>
      </div>

      {/* Nail Art */}
      <div className="bg-gray-50 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
        <img
          src="/images/women plaiting.jpg"
          alt="Nail Art"
          className="w-full h-64 object-cover rounded-t-xl"
        />
        <div className="p-4 text-center">
          <h3 className="text-xl font-semibold mb-2">Women Art</h3>
          <p className="text-gray-600 text-sm">
            Beautiful hair style designs to match your style. Every detail is crafted with care.
          </p>
        </div>
      </div>

      {/* Skincare & Facial */}
      <div className="bg-gray-50 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
        <img
          src="/images/skin treatment.webp"
          alt="Skincare & Facial"
          className="w-full h-64 object-cover rounded-t-xl"
        />
        <div className="p-4 text-center">
          <h3 className="text-xl font-semibold mb-2">Skincare & Facial</h3>
          <p className="text-gray-600 text-sm">
            Luxurious facial treatments and skincare services to refresh and rejuvenate your skin, leaving you glowing and confident.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>


      {/* ================= TOOLS & EQUIPMENT ================= */}
      

      <section className="py-16 bg-gray-100">
  <div className="max-w-7xl mx-auto px-6 text-center">
    <h2 className="text-3xl font-bold mb-6 text-gray-800">Our Tools & Hygiene</h2>
    <p className="text-gray-600 max-w-3xl mx-auto mb-10">
      Only the best and sterilized tools for hair, nails, and massage. Your health and comfort is our priority.
    </p>

    <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Makeup Tools */}
      <div className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition">
        <img
          src="/images/make up tools.jpg"
          alt="Makeup Tools"
          className="w-full h-48 object-cover rounded mb-4"
        />
        <h3 className="text-xl font-semibold mb-2">Makeup Tools</h3>
        <p className="text-gray-700 text-sm">
          High-quality brushes, sponges, and applicators for flawless makeup application.
        </p>
      </div>

      {/* Women Hair Tools */}
      <div className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition">
        <img
          src="/images/hair dressing tools.webp"
          alt="Women Hair Tools"
          className="w-full h-48 object-cover rounded mb-4"
        />
        <h3 className="text-xl font-semibold mb-2">Women Hair Tools</h3>
        <p className="text-gray-700 text-sm">
          Combs, scissors, and styling machines — sterilized and ready for professional care.
        </p>
      </div>

      {/* Skincare Tools */}
      <div className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition">
        <img
          src="/images/skin treatment.webp"
          alt="Skincare Tools"
          className="w-full h-48 object-cover rounded mb-4"
        />
        <h3 className="text-xl font-semibold mb-2">Skincare Tools</h3>
        <p className="text-gray-700 text-sm">
          Clean and sanitized tools for facials, massage, and rejuvenating skincare treatments.
        </p>
      </div>

      {/* Feet Care */}
      <div className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition">
        <img
          src="images/feet care.jpg"
          alt="Feet Care Tools"
          className="w-full h-48 object-cover rounded mb-4"
        />
        <h3 className="text-xl font-semibold mb-2">Feet Care</h3>
        <p className="text-gray-700 text-sm">
          Sterilized foot baths and pedicure tools to ensure safe and relaxing treatments.
        </p>
      </div>
    </div>
  </div>
</section>


    <section className="py-16 bg-white">
  <div className="max-w-7xl mx-auto px-6">
     <h2 className="text-3xl font-bold mb-6 text-gray-800">Our Tools & Hygiene</h2>

    <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-10 items-center">

      {/* IMAGE */}
      <div className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition duration-300 animate-fadeInLeft">
        <img
          src="/images/kids service.jpg"
          alt="Kids salon service"
          className="w-full h-64 object-cover rounded-xl"
        />
      </div>

      {/* TEXT */}
      <div className="flex flex-col justify-center items-center text-center animate-fadeInRight px-4">
        <p className="text-gray-700 text-lg leading-relaxed max-w-md">
          We take care of the little ones too, since they are the future of this world.  
          Our skilled team creates a calm and friendly environment, ensuring that every child feels 
          comfortable and enjoys their salon experience. We make your children look angelic with care,
          patience, and a touch of fun.
        </p>
      </div>

    </div>

  </div>
</section>



      {/* ================= INSIDE SALON ================= */}
     <section className="py-16 bg-white">
  <div className="max-w-7xl mx-auto px-6">
    <h2 className="text-3xl font-bold mb-4 text-gray-800 text-center">Inside Our Salon</h2>
    <p className="text-gray-600 max-w-3xl mx-auto mb-10 text-center">
      Elegant and comfortable spaces designed for relaxation while we take care of you.
    </p>

    <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6">
      {/* Washing Area */}
      <div className="rounded-xl overflow-hidden shadow-md hover:shadow-lg transition">
        <img
          src="/images/washing after shave.jpg"
          alt="Washing Area"
          className="w-full h-64 object-cover"
        />
        <h3 className="text-xl font-semibold p-4 text-gray-800">Washing Area</h3>
        <p className="p-4 text-gray-700">
          Clean and comfortable washing stations, designed for relaxation and hygienic hair care.
        </p>
      </div>

      {/* Towels / Linen Hygiene */}
      <div className="rounded-xl overflow-hidden shadow-md hover:shadow-lg transition">
        <img
          src="/images/salon towels.jpg"
          alt="Towels & Linen"
          className="w-full h-64 object-cover"
        />
        <h3 className="text-xl font-semibold p-4 text-gray-800">Towels & Linen</h3>
        <p className="p-4 text-gray-700">
          Freshly laundered towels and linens ensure maximum hygiene and comfort for every client.
        </p>
      </div>
    </div>
  </div>
</section>


      {/* ================= MASSAGE & RELAXATION ================= */}
      

      <section className="py-16 bg-gray-100">
  <div className="max-w-7xl mx-auto px-6 text-center">
    <h2 className="text-3xl font-bold mb-6 text-gray-800">Massage & Relaxation</h2>
    <p className="text-gray-600 max-w-3xl mx-auto mb-10">
      Our massage treatments use premium oils and techniques to relieve stress and rejuvenate your body and mind.
    </p>

    <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6">
      {/* Full Body Massage */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden">
        <img
          src="/images/massage image.webp"
          alt="Full Body Massage"
          className="w-full h-64 object-cover"
        />
        <h3 className="text-xl font-semibold p-4 text-gray-800">Full Body Massage Area</h3>
        <p className="p-4 text-gray-700">
          Relax and rejuvenate with our full body massage with our special massage area designed to relax your mind and heart.
        </p>
      </div>

      {/* Foot & Reflexology Massage */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden">
        <img
          src="/images/skin care bottles.webp"
          alt="premium oils"
          className="w-full h-64 object-cover"
        />
        <h3 className="text-xl font-semibold p-4 text-gray-800">Premium Oils</h3>
        <p className="p-4 text-gray-700">
          With our Premium Oils in reflexology treatments, perfect for relieving stress and enhancing overall wellness.
        </p>
      </div>
    </div>
  </div>
</section>


      {/* ================= CLIENT TESTIMONIALS ================= */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-10 text-gray-800">What Our Clients Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "ryain", feedback: "Amazing experience! Highly recommend.", img: "/images/client-ian.jpg" },
              { name: "abdullah", feedback: "Friendly staff and excellent service.", img: "/images/client-ssenyonjo.jpg" },
              { name: "Jane", feedback: "Best salon experience I've had!", img: "/images/client-rachel.jpg" },
              { name: "willy", feedback: "Beautiful results, very professional.", img: "/images/client-sharifa.jpg" },
            ].map((c, idx) => (
              <div key={idx} className="bg-gray-50 p-6 rounded-xl shadow-md hover:shadow-lg transition">
                <img src={c.img} alt={c.name} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" />
                <p className="text-gray-700 italic mb-3">“{c.feedback}”</p>
                <h4 className="font-semibold text-gray-800">{c.name}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DIGITAL BOOKING ================= */}
      <section className="py-16 bg-gray-100 flex flex-col justify-center align-center">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-800">Book Appointments Online</h2>
          <p className="text-gray-600 max-w-3xl mx-auto mb-6">
            Easily create an account and book your appointments online. Already have an account? Simply sign in.
          </p>
          <img
            src="/images/appointment_dashboard.jpg"
            alt="Digital booking"
            className="w-full md:w-[70vw] h-80 md:h-90 object-cover rounded-xl mb-6 shadow-md"
          />
          <p className="text-gray-700 mb-4">
            Click “Account” at the top to get started.
          </p>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-12 bg-blue-600 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready for Your Next Look?</h2>
        <p className="text-lg mb-6">
          Book an appointment today and step into your most confident self.
        </p>
        <img
            src="/images/hair cut meme.jpg"
            alt="Digital booking"
            className="w-full md:h-90 h-40 object-cover rounded-xl mb-6 shadow-md"
          />
      </section>

      <Footer />
    </div>
  );
}
