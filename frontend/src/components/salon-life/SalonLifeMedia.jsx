import { galleryMedia } from "../../content/publicContent.js";
import BackgroundVideoStory from "../public/BackgroundVideoStory.jsx";
import SectionHeading from "../public/SectionHeading.jsx";

export default function SalonLifeMedia() {
  const images = galleryMedia.filter((item) => item.type === "image").slice(0, 4);
  const featuredVideo = galleryMedia.find((item) => item.type === "video");
  return <section className="salon-section"><div className="salon-container"><SectionHeading eyebrow="Everyday salon life" title="People, practice and moments between appointments." description="Salon Life is the visual story of the workplace: images and videos from team learning, client care and everyday activity." /><div className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div data-aos="fade-right"><BackgroundVideoStory item={featuredVideo} videoClassName="aspect-video" showDate={false} /></div><div className="grid grid-cols-2 gap-4">{images.map((item, index) => <figure key={item.id} data-aos="zoom-in" data-aos-delay={index * 60} className="group relative overflow-hidden rounded-3xl"><img src={item.src} alt={item.title} className="aspect-square h-full w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" /><figcaption className="absolute bottom-4 left-4 right-4 text-sm font-semibold text-white">{item.title}</figcaption></figure>)}</div></div></div></section>;
}
