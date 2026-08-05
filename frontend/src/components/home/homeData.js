import { Baby, Droplets, HeartHandshake, Scissors, ShieldCheck, Sparkles } from "lucide-react";

export const serviceCategories = [
  { title: "Precision cuts", description: "Contemporary cuts, fades, beard shaping and finishing for every personal style.", image: "/images/professional cuts.jpg", icon: Scissors },
  { title: "Braids & styling", description: "Protective styling, braiding and polished looks created with care and patience.", image: "/images/women plaiting2.jpg", icon: Sparkles },
  { title: "Skin rituals", description: "Cleansing and revitalising treatments designed around your skin's needs.", image: "/images/happy service skin care.webp", icon: Droplets },
  { title: "Family care", description: "A calm, friendly experience for children and families who value patient service.", image: "/images/kids service.jpg", icon: Baby },
  { title: "Massage & wellness", description: "Restorative sessions that help release tension and renew your energy.", image: "/images/massage image.webp", icon: HeartHandshake },
  { title: "Hygiene-first service", description: "Clean tools, fresh linen and carefully prepared stations for every guest.", image: "/images/salon tools.jpg", icon: ShieldCheck },
];

export const gallery = [
  { src: "/images/western cuts.jpg", label: "Modern grooming", span: "md:col-span-2 md:row-span-2" },
  { src: "/images/women plaiting.jpg", label: "Braiding artistry" },
  { src: "/images/skin treatment.webp", label: "Skin care" },
  { src: "/images/beard clippers.jpg", label: "Beard detailing" },
  { src: "/images/feet care.jpg", label: "Foot care" },
];

export const testimonials = [
  { quote: "The team listened carefully and gave me a look that felt completely like me. Professional from start to finish.", name: "Amina", service: "Hair styling" },
  { quote: "The environment is calm, clean and welcoming. I could see the care put into every tool and every detail.", name: "Daniel", service: "Grooming" },
  { quote: "Booking was easy and the family service was patient and warm. My child left smiling and confident.", name: "Sarah", service: "Family appointment" },
];
