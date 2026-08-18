import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { galleryMedia } from "../../content/publicContent.js";
import BackgroundVideoStory from "../public/BackgroundVideoStory.jsx";
import SectionHeading from "../public/SectionHeading.jsx";

export default function SalonLifePreview() {
  const video = galleryMedia.find((item) => item.type === "video");
  const images = galleryMedia.filter((item) => item.type === "image").slice(0, 3);
  return <section className="salon-section"><div className="salon-container"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Life at Salehish" title="The work, people and energy behind every visit." description="A growing visual journal of transformations, everyday service, team moments and salon events." /><Link to="/gallery" className="salon-button-primary shrink-0">Open full gallery <ArrowUpRight size={17} /></Link></div><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div className="md:col-span-2 lg:row-span-2" data-aos="zoom-in"><BackgroundVideoStory item={video} videoClassName="aspect-[16/10] lg:aspect-auto lg:min-h-[520px]" showDate={false} /></div>{images.map((item, index) => <figure key={item.id} data-aos="zoom-in" data-aos-delay={(index + 1) * 70} className={`group relative overflow-hidden rounded-[1.75rem] ${index === 2 ? "lg:col-span-2" : ""}`}><img src={item.src} alt={item.title} className="aspect-[4/3] h-full min-h-[250px] w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" /><figcaption className="absolute bottom-5 left-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-300">{item.category}</p><p className="mt-1 font-serif text-xl font-semibold text-white">{item.title}</p></figcaption></figure>)}</div></div></section>;
}
