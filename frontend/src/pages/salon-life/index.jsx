import { Link } from "react-router-dom";
import PublicPageHero from "../../components/public/PublicPageHero.jsx";
import SalonLifeMedia from "../../components/salon-life/SalonLifeMedia.jsx";
import CultureMoments from "../../components/salon-life/CultureMoments.jsx";

export default function SalonLifePage() {
  return <><PublicPageHero eyebrow="Salon life" title="The people and moments beyond the chair." description="Images and videos from everyday service, teamwork, learning and the social rhythm of Salehish." image="/images/salon_interior1.jpg" imageAlt="Life inside the Salehish salon" /><SalonLifeMedia /><CultureMoments /><section className="salon-section bg-[var(--salon-ink)] text-center text-white"><div className="salon-container" data-aos="fade-up"><p className="salon-eyebrow text-amber-300">Explore more</p><h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-semibold sm:text-5xl">See the complete picture and video archive.</h2><Link to="/gallery" className="salon-button-gold mt-8">Open the gallery</Link></div></section></>;
}
