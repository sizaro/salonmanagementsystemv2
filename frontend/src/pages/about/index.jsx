import { Link } from "react-router-dom";
import PublicPageHero from "../../components/public/PublicPageHero.jsx";
import AboutStory from "../../components/about/AboutStory.jsx";
import SalonReport from "../../components/about/SalonReport.jsx";
import SalonDirection from "../../components/about/SalonDirection.jsx";
import Values from "../../components/about/Values.jsx";
import LeadershipTeam from "../../components/about/LeadershipTeam.jsx";
import TeamCulture from "../../components/about/TeamCulture.jsx";

export default function AboutPage() {
  return <><PublicPageHero eyebrow="About Salehish" title="A growing salon story, built around people." description="Discover where Salehish began, what we are working toward and the professionals behind our inclusive salon experience." image="/images/washing after shave.jpg" imageAlt="Professional salon care at Salehish" /><AboutStory /><SalonReport /><SalonDirection /><Values /><LeadershipTeam /><TeamCulture /><section className="salon-section bg-[var(--salon-ink)] text-center text-white"><div className="salon-container" data-aos="fade-up"><p className="salon-eyebrow text-amber-300">Experience it yourself</p><h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-semibold sm:text-5xl">The best way to understand Salehish is to spend time with us.</h2><Link to="/contact" className="salon-button-gold mt-8">Plan your visit</Link></div></section></>;
}
