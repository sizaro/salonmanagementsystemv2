import { Link } from "react-router-dom";
import PublicPageHero from "../../components/public/PublicPageHero.jsx";
import ServiceMenu from "../../components/services/ServiceMenu.jsx";
import ServicePromise from "../../components/services/ServicePromise.jsx";
import { detailedServices } from "../../content/publicContent.js";

export default function ServicesPage() {
  return <><PublicPageHero eyebrow="Our services" title="Know what to expect before you arrive." description="Explore detailed grooming, styling, skin care, family and wellness experiences. Final timing and pricing are confirmed during consultation." image="/images/professional cuts.jpg" imageAlt="A precise professional haircut" /><ServiceMenu services={detailedServices} /><ServicePromise /><section className="salon-section text-center"><div className="salon-container" data-aos="fade-up"><p className="salon-eyebrow text-[var(--salon-copper)]">Ready to book?</p><h2 className="mx-auto mt-4 max-w-2xl font-serif text-4xl font-semibold">Create your customer account, enter the portal and request your service.</h2><Link to="/contact" className="salon-button-primary mt-8">See how booking works</Link></div></section></>;
}
