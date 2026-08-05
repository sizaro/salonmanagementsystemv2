import { detailedServices } from "../../content/publicContent.js";
import Hero from "../../components/home/Hero.jsx";
import TrustStats from "../../components/home/TrustStats.jsx";
import SalonStory from "../../components/home/SalonStory.jsx";
import SignatureServices from "../../components/home/SignatureServices.jsx";
import ServiceCategories from "../../components/home/ServiceCategories.jsx";
import TransformationGallery from "../../components/home/TransformationGallery.jsx";
import TeamPreview from "../../components/home/TeamPreview.jsx";
import HygienePromise from "../../components/home/HygienePromise.jsx";
import FamilyCare from "../../components/home/FamilyCare.jsx";
import WellnessEscape from "../../components/home/WellnessEscape.jsx";
import BookingJourney from "../../components/home/BookingJourney.jsx";
import Testimonials from "../../components/home/Testimonials.jsx";
import AppointmentCta from "../../components/home/AppointmentCta.jsx";
import VisitPreview from "../../components/home/VisitPreview.jsx";
import QuoteInterlude from "../../components/home/QuoteInterlude.jsx";
import UpcomingEvents from "../../components/home/UpcomingEvents.jsx";
import SalonLifePreview from "../../components/home/SalonLifePreview.jsx";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStats />
      <SalonStory />
      <SignatureServices services={detailedServices} />
      <ServiceCategories />
      <QuoteInterlude />
      <TransformationGallery />
      <TeamPreview />
      <SalonLifePreview />
      <UpcomingEvents />
      <HygienePromise />
      <FamilyCare />
      <WellnessEscape />
      <BookingJourney />
      <Testimonials />
      <AppointmentCta />
      <VisitPreview />
    </>
  );
}
