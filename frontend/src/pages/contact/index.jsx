import PublicPageHero from "../../components/public/PublicPageHero.jsx";
import ContactDetails from "../../components/contact/ContactDetails.jsx";
import BookingPortalGuide from "../../components/contact/BookingPortalGuide.jsx";
import LocationMap from "../../components/contact/LocationMap.jsx";

export default function ContactPage() {
  return <><PublicPageHero eyebrow="Contact & location" title="Reach the team or plan your route." description="WhatsApp is fastest for questions. For appointments, create a customer account and book securely through your portal." image="/images/appointment_dashboard.jpg" imageAlt="Planning a salon appointment" /><ContactDetails /><BookingPortalGuide /><LocationMap /></>;
}
