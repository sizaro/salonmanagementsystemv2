export const business = {
  name: "Salehish Beauty Parlour & Spa",
  phone: "+256 700 000 000",
  phoneHref: "tel:+256700000000",
  whatsapp: "+256 700 000 000",
  whatsappHref: "https://wa.me/256700000000",
  email: "hello@salehish.com",
  emailHref: "mailto:hello@salehish.com",
  address: "Cathedral Road, Bugembe, Jinja, Uganda",
  directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=Cathedral+Road%2C+Bugembe%2C+Jinja%2C+Uganda",
  mapEmbedUrl: "https://www.google.com/maps?q=Cathedral+Road%2C+Bugembe%2C+Jinja%2C+Uganda&output=embed",
  developerName: "SizaForge Tech",
  developerUrl: "https://sizaforge.tech",
};

export const socialLinks = [
  { name: "YouTube", href: "https://www.youtube.com/", platform: "youtube" },
  { name: "TikTok", href: "https://www.tiktok.com/", platform: "tiktok" },
  { name: "Instagram", href: "https://www.instagram.com/", platform: "instagram" },
  { name: "Facebook", href: "https://www.facebook.com/", platform: "facebook" },
  { name: "WhatsApp", href: business.whatsappHref, platform: "whatsapp" },
];

export const teamMembers = [
  { id: "owner", name: "Salon Founder", role: "Founder & Creative Director", image: "/images/professional cuts.jpg", bio: "Leads Salehish with a focus on skilled service, responsible growth and an experience where every guest feels known.", featured: true },
  { id: "manager", name: "Salon Manager", role: "Operations Manager", image: "/images/women plaiting2.jpg", bio: "Coordinates the guest journey, supports the team and keeps every service day organised and welcoming.", featured: true },
  { id: "cashier", name: "Client Care Lead", role: "Cashier & Client Care", image: "/images/appointment_dashboard.jpg", bio: "Helps guests with bookings, payments and the small details that make each visit run smoothly.", featured: true },
  { id: "barber", name: "Senior Barber", role: "Senior Barber", image: "/images/western cuts.jpg", bio: "Specialises in precision cuts, clean fades, beard care and practical advice for maintaining every look.", featured: true },
];

export const leadership = teamMembers.slice(0, 2);
export const teamProfessionals = teamMembers.slice(2);

export const placeholderVideoUrl = "https://player.cloudinary.com/embed/?cloud_name=dp76nuyie&public_id=mhstrial_geiacr";

export const salonMilestones = [
  { value: 2020, suffix: "", label: "Year our story began" },
  { value: 6, suffix: "+", label: "Years serving our community" },
  { value: 20, suffix: "+", label: "Beauty and grooming services" },
  { value: 1000, suffix: "+", label: "Guest visits and growing" },
];

export const salonGoals = [
  { title: "Our vision", copy: "To become Jinja's most trusted inclusive destination for beauty, grooming and everyday wellness." },
  { title: "Our goal", copy: "To deliver consistent professional care while creating meaningful work and continuous learning for our team." },
  { title: "Our focus", copy: "Clean service, thoughtful consultation, accessible booking and results that respect every guest's individuality." },
];

export const salonQuotes = [
  "Beauty is most powerful when it still feels like you.",
  "A good appointment changes more than a look; it changes how the day feels.",
  "Confidence grows in spaces where people are listened to and cared for.",
];

export const upcomingEvents = [
  { id: "community-day", date: "Date to be announced", title: "Salehish Community Beauty Day", type: "Community", description: "A relaxed day of consultations, grooming conversations and special community offers.", image: "/images/salon_interior1.jpg" },
  { id: "team-celebration", date: "Coming soon", title: "Team Member Celebration", type: "Salon life", description: "Celebrating the birthdays, growth and milestones of the people who make Salehish special.", image: "/images/women plaiting.jpg" },
  { id: "style-session", date: "Coming soon", title: "Style & Care Learning Session", type: "Learning", description: "Simple professional guidance for maintaining hair, skin and grooming results between visits.", image: "/images/hair dressing tools.webp" },
];

export const galleryMedia = [
  { id: 1, type: "image", src: "/images/western cuts.jpg", poster: "/images/western cuts.jpg", title: "Precision in progress", category: "Grooming", publishedAt: "2026-08-05" },
  { id: 2, type: "image", src: "/images/women plaiting.jpg", poster: "/images/women plaiting.jpg", title: "Braiding artistry", category: "Hair", publishedAt: "2026-08-04" },
  { id: 3, type: "video", src: placeholderVideoUrl, poster: "/images/washing after shave.jpg", title: "Inside a grooming session", category: "Service video", publishedAt: "2026-08-03" },
  { id: 4, type: "image", src: "/images/skin treatment.webp", poster: "/images/skin treatment.webp", title: "Restorative skin care", category: "Wellness", publishedAt: "2026-08-02" },
  { id: 5, type: "image", src: "/images/kids service.jpg", poster: "/images/kids service.jpg", title: "Patient family care", category: "Family", publishedAt: "2026-08-01" },
  { id: 6, type: "video", src: placeholderVideoUrl, poster: "/images/salon_interior1.jpg", title: "Life at Salehish", category: "Salon video", publishedAt: "2026-07-31" },
  { id: 7, type: "image", src: "/images/feet care.jpg", poster: "/images/feet care.jpg", title: "Care in every detail", category: "Wellness", publishedAt: "2026-07-30" },
  { id: 8, type: "image", src: "/images/salon tools.jpg", poster: "/images/salon tools.jpg", title: "Prepared with care", category: "Standards", publishedAt: "2026-07-29" },
  { id: 9, type: "video", src: placeholderVideoUrl, poster: "/images/professional cuts.jpg", title: "A professional service moment", category: "Service video", publishedAt: "2026-07-28" },
  { id: 10, type: "image", src: "/images/beard clippers.jpg", poster: "/images/beard clippers.jpg", title: "Tools of the craft", category: "Grooming", publishedAt: "2026-07-27" },
  { id: 11, type: "image", src: "/images/salon towels.jpg", poster: "/images/salon towels.jpg", title: "Ready for every guest", category: "Standards", publishedAt: "2026-07-26" },
  { id: 12, type: "video", src: placeholderVideoUrl, poster: "/images/women plaiting2.jpg", title: "Creative styling in motion", category: "Hair video", publishedAt: "2026-07-25" },
];

export const detailedServices = [
  { id: "cuts", service_name: "Precision Haircuts & Fades", category: "Barbering", description: "Consultation-led cuts for classic, modern and low-maintenance styles, including fades, line-ups and finishing.", image_url: "/images/professional cuts.jpg", idealFor: "Men, boys and short styles", includes: ["Style consultation", "Precision cut or fade", "Finishing and home-care guidance"], duration: "30-60 minutes" },
  { id: "beard", service_name: "Beard Shaping & Grooming", category: "Barbering", description: "Clean shaping that balances your features while keeping the beard comfortable and easy to maintain.", image_url: "/images/beard clippers.jpg", idealFor: "Beard maintenance and reshaping", includes: ["Shape consultation", "Trim and line definition", "Finishing care"], duration: "20-40 minutes" },
  { id: "braids", service_name: "Braids & Protective Styling", category: "Hair", description: "Patient, detailed protective styling created around your preferred look, comfort and hair needs.", image_url: "/images/women plaiting2.jpg", idealFor: "Protective and expressive styles", includes: ["Style consultation", "Sectioning and styling", "Care guidance"], duration: "Time confirmed at consultation" },
  { id: "treatment", service_name: "Hair Treatment & Care", category: "Hair", description: "A restorative care session selected according to the condition, texture and needs of your hair.", image_url: "/images/washing after shave.jpg", idealFor: "Dryness, maintenance and refresh", includes: ["Hair assessment", "Cleansing and treatment", "Finishing advice"], duration: "45-90 minutes" },
  { id: "skin", service_name: "Facial & Skin Ritual", category: "Skin", description: "A calming cleanse and revitalising treatment tailored to your current skin concerns and comfort.", image_url: "/images/skin treatment.webp", idealFor: "Routine care and skin refresh", includes: ["Skin consultation", "Cleanse and treatment", "After-care guidance"], duration: "45-75 minutes" },
  { id: "massage", service_name: "Massage & Relaxation", category: "Wellness", description: "A restorative wellness session designed to help reduce everyday tension and create room to reset.", image_url: "/images/massage image.webp", idealFor: "Relaxation and tension relief", includes: ["Comfort consultation", "Focused massage session", "Post-session guidance"], duration: "30-90 minutes" },
  { id: "feet", service_name: "Foot Care & Pedicure", category: "Wellness", description: "Clean, careful foot and nail attention with a polished finish in a calm setting.", image_url: "/images/feet care.jpg", idealFor: "Routine foot and nail care", includes: ["Preparation and soak", "Nail and skin care", "Selected finish"], duration: "45-75 minutes" },
  { id: "children", service_name: "Children's Grooming", category: "Family", description: "A patient, friendly grooming experience paced to help younger guests feel safe and confident.", image_url: "/images/kids service.jpg", idealFor: "Children and family appointments", includes: ["Parent-guided consultation", "Patient service", "Simple finishing"], duration: "30-60 minutes" },
];
