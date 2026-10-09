import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function ClientCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/marketplace/campaigns`).then(({ data }) => {
      if (active) setCampaigns(data.campaigns || []);
    }).catch(() => {}).finally(() => {});
    return () => { active = false; };
  }, []);
  if (!campaigns.length) return null;
  return <section className="bg-stone-950 px-5 py-16 text-white sm:px-8"><div className="mx-auto max-w-6xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">At the salon</p><h2 className="mt-2 text-3xl font-bold">Offers and upcoming moments</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{campaigns.map((campaign) => <article key={campaign.id} className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-xs font-bold uppercase tracking-widest text-amber-200">{campaign.campaign_type}</p><h3 className="mt-3 text-xl font-bold">{campaign.title}</h3>{campaign.discount_percent && <p className="mt-3 text-3xl font-black text-amber-300">{campaign.discount_percent}% OFF</p>}<p className="mt-3 text-sm leading-6 text-stone-200">{campaign.description}</p><p className="mt-4 text-xs text-stone-400">Until {new Date(campaign.ends_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</p></article>)}</div></div></section>;
}
