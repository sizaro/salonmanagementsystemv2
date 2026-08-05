import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import SectionHeading from "../public/SectionHeading.jsx";
import { gallery } from "./homeData.js";

export default function TransformationGallery() {
  return <section className="salon-section bg-white"><div className="salon-container"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Our work" title="Details that make the whole look." description="A glimpse of the craft, care and range behind the Salehish experience." /><Link to="/gallery" className="salon-button-secondary shrink-0">View gallery <ArrowUpRight size={17} /></Link></div><div className="mt-12 grid auto-rows-[220px] gap-4 md:grid-cols-4">{gallery.map((item, index) => <figure key={item.src} data-aos="zoom-in" data-aos-delay={index * 60} className={`group relative overflow-hidden rounded-[1.6rem] ${item.span || ""}`}><img src={item.src} alt={item.label} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" /><figcaption className="absolute bottom-4 left-5 text-sm font-semibold text-white">{item.label}</figcaption></figure>)}</div></div></section>;
}
