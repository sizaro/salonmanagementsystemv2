import { Clock3, Facebook, Instagram, MapPin, MessageCircle, Phone, Scissors, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { business, socialLinks } from "../../content/publicContent.js";

const socialIcons = { youtube: Youtube, instagram: Instagram, facebook: Facebook, whatsapp: MessageCircle };

function TikTokIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current"><path d="M19.6 7.1a5.8 5.8 0 0 1-3.5-1.2v8.2a6.2 6.2 0 1 1-5.3-6.1v3.1a3.1 3.1 0 1 0 2.2 3V1.8h3.1c.2 1.8 1.6 3.3 3.5 3.7v1.6Z" /></svg>;
}

export default function Footer() {
  return (
    <footer className="bg-[var(--salon-ink)] text-white">
      <div className="salon-container grid gap-12 py-16 md:grid-cols-2 xl:grid-cols-[1.3fr_.75fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-amber-300"><Scissors size={21} /></span><div><p className="font-serif text-2xl font-semibold">Salehish</p><p className="text-xs uppercase tracking-[0.2em] text-amber-300">Beauty Parlour & Spa</p></div></div>
          <p className="mt-6 max-w-sm leading-7 text-white/60">Thoughtful grooming, expressive beauty and restorative wellness delivered by a team that takes your comfort seriously.</p>
          <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-white/45">Follow salon life</p>
          <div className="mt-3 flex flex-wrap gap-3">{socialLinks.map((social) => { const Icon = socialIcons[social.platform]; return <a key={social.name} href={social.href} target="_blank" rel="noreferrer" aria-label={social.name} title={social.name} className="footer-social">{social.platform === "tiktok" ? <TikTokIcon /> : <Icon size={18} />}</a>; })}</div>
        </div>
        <div><h3 className="footer-title">Explore</h3><div className="mt-5 grid gap-3 text-sm text-white/65"><Link to="/about" className="hover:text-amber-300">Our story</Link><Link to="/services" className="hover:text-amber-300">Service menu</Link><Link to="/gallery" className="hover:text-amber-300">Gallery</Link><Link to="/salon-life" className="hover:text-amber-300">Salon life</Link><Link to="/events-news" className="hover:text-amber-300">Events & news</Link><Link to="/contact" className="hover:text-amber-300">Contact & location</Link></div></div>
        <div><h3 className="footer-title">Visit us</h3><div className="mt-5 space-y-4 text-sm text-white/65"><a href={business.directionsUrl} target="_blank" rel="noreferrer" className="flex gap-3 hover:text-amber-300"><MapPin size={18} className="shrink-0 text-amber-300" /> {business.address}</a><a href={business.phoneHref} className="flex gap-3 hover:text-amber-300"><Phone size={18} className="shrink-0 text-amber-300" /> {business.phone}</a><a href={business.whatsappHref} target="_blank" rel="noreferrer" className="flex gap-3 hover:text-amber-300"><MessageCircle size={18} className="shrink-0 text-amber-300" /> WhatsApp appointments</a></div></div>
        <div><h3 className="footer-title">Opening hours</h3><div className="mt-5 space-y-3 text-sm text-white/65"><p className="flex gap-3"><Clock3 size={18} className="shrink-0 text-amber-300" /><span>Monday-Saturday<br /><strong className="font-medium text-white">8:00 AM-8:00 PM</strong></span></p><p>Sunday appointments available by arrangement.</p></div></div>
      </div>
      <div className="border-t border-white/10"><div className="salon-container flex flex-col gap-3 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} {business.name}.</p><p>Developed and maintained by <a href={business.developerUrl} target="_blank" rel="noreferrer" className="font-semibold text-amber-300 transition hover:text-white">{business.developerName}</a></p></div></div>
    </footer>
  );
}
