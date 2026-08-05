import PublicPageHero from "../../components/public/PublicPageHero.jsx";
import EventsBoard from "../../components/salon-life/EventsBoard.jsx";

export default function EventsNewsPage() {
  return <><PublicPageHero eyebrow="Events & news" title="Announcements with the detail guests need." description="Upcoming activities, salon celebrations, community moments, offers and important updates from Salehish." image="/images/hair dressing tools.webp" imageAlt="Salon tools prepared for an upcoming activity" /><EventsBoard /><section className="salon-section bg-white"><div className="salon-container grid gap-8 rounded-[2rem] bg-[var(--salon-cream)] p-7 sm:p-10 lg:grid-cols-[.7fr_1.3fr] lg:items-center"><p className="salon-eyebrow text-[var(--salon-copper)]">Publishing note</p><p className="text-base leading-8 text-slate-600">Each future announcement can carry its own date, cover image, full story, location, event time and registration instructions. The prepared cards currently use editable placeholder content.</p></div></section></>;
}
