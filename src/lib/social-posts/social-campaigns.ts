import type { SocialAgentInput } from "./social-agent";

export type SocialCampaign = {
  id: string;
  label: string;
  description: string;
  businessFocus: NonNullable<SocialAgentInput["businessFocus"]>;
  defaultMediaType: NonNullable<SocialAgentInput["mediaType"]>;
  goalTemplates: string[];
  captionAngles: string[];
  promptAngles: string[];
  preferredImageKeywords: string[];
};

export const SOCIAL_CAMPAIGNS: SocialCampaign[] = [
  {
    id: "summer-water-slides",
    label: "Summer Water Slides",
    description: "Push high-energy summer slide rentals for hot weekends.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote water slides for hot weather"],
    captionAngles: ["Cool off with a backyard waterslide weekend."],
    promptAngles: ["bright summer backyard, colorful waterslide, splash energy"],
    preferredImageKeywords: ["water", "waterslide", "summer", "splash"],
  },
  {
    id: "birthday-parties",
    label: "Birthday Parties",
    description: "Promote easy birthday planning with Jumping Jax fun.",
    businessFocus: "both",
    defaultMediaType: "video",
    goalTemplates: ["Promote birthday party bookings"],
    captionAngles: ["Make the birthday feel big without making planning hard."],
    promptAngles: ["happy birthday party, smiling families, colorful inflatables"],
    preferredImageKeywords: ["birthday", "party", "bounce", "combo"],
  },
  {
    id: "backyard-fun",
    label: "Backyard Fun",
    description: "Show family-friendly inflatable fun at home.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote clean and safe local family fun"],
    captionAngles: ["Turn the backyard into the main event."],
    promptAngles: ["backyard party, clean inflatable setup, family fun"],
    preferredImageKeywords: ["bounce", "combo", "backyard"],
  },
  {
    id: "comedy-kids-acting-like-adults",
    label: "Comedy: Kids Acting Like Adults",
    description: "Playful kid-led ad concept with adult supervision implied.",
    businessFocus: "both",
    defaultMediaType: "video",
    goalTemplates: ["Promote clean and safe local family fun"],
    captionAngles: ["A playful ad concept where kids take party planning very seriously."],
    promptAngles: ["comedic family-friendly ad, kids pretending to run a party meeting"],
    preferredImageKeywords: ["party", "birthday", "bounce"],
  },
  {
    id: "beat-the-heat",
    label: "Beat the Heat",
    description: "Hot-weather rentals with splashy urgency.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote water slides for hot weather"],
    captionAngles: ["When the forecast heats up, the party should cool down."],
    promptAngles: ["hot sunny day, waterslide, cool splash, energetic families"],
    preferredImageKeywords: ["hot", "water", "splash", "slide"],
  },
  {
    id: "church-events",
    label: "Church Events",
    description: "Promote safe, crowd-friendly rentals for church gatherings.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote church/daycare/school events"],
    captionAngles: ["Make church events easier to plan and more fun to attend."],
    promptAngles: ["church event, families, clean inflatable, organized outdoor fun"],
    preferredImageKeywords: ["church", "event", "combo", "bounce"],
  },
  {
    id: "schools-daycares",
    label: "Schools & Daycares",
    description: "Promote inflatables for school, daycare, and field-day events.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote church/daycare/school events"],
    captionAngles: ["Big fun for school days, daycare celebrations, and field events."],
    promptAngles: ["school event, daycare celebration, colorful inflatable, safe setup"],
    preferredImageKeywords: ["school", "daycare", "event", "combo"],
  },
  {
    id: "toddler-fun",
    label: "Toddler Fun",
    description: "Highlight toddler-friendly inflatable options.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote toddler-friendly inflatables"],
    captionAngles: ["Little guests deserve big smiles too."],
    promptAngles: ["toddler-friendly party, small kids, gentle colorful inflatable"],
    preferredImageKeywords: ["toddler", "little kids", "preschool", "candy land"],
  },
  {
    id: "last-minute-availability",
    label: "Last-Minute Availability",
    description: "Create urgency around openings for upcoming dates.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote last-minute rental availability"],
    captionAngles: ["A last-minute opening can still become the best party of the week."],
    promptAngles: ["upbeat last-minute party rental ad, colorful inflatable ready to book"],
    preferredImageKeywords: ["bounce", "combo", "weekend"],
  },
  {
    id: "customer-testimonials",
    label: "Customer Testimonials",
    description: "Frame social proof and parent-friendly trust.",
    businessFocus: "both",
    defaultMediaType: "video",
    goalTemplates: ["Promote clean and safe local family fun"],
    captionAngles: ["Local families trust Jumping Jax for clean, easy party fun."],
    promptAngles: ["testimonial-style family ad, clean setup, happy parent energy"],
    preferredImageKeywords: ["family", "party", "bounce"],
  },
  {
    id: "new-inventory",
    label: "New Inventory",
    description: "Announce or tease new rental options.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote weekend inflatable rental openings"],
    captionAngles: ["Fresh rental options mean fresh party ideas."],
    promptAngles: ["new inflatable rental spotlight, colorful product-focused ad"],
    preferredImageKeywords: ["combo", "slide", "bounce"],
  },
  {
    id: "private-parties",
    label: "Private Parties",
    description: "Promote private party bookings and reserved celebrations.",
    businessFocus: "facility-parties",
    defaultMediaType: "video",
    goalTemplates: ["Promote private party bookings"],
    captionAngles: ["A private party gives families room to celebrate their way."],
    promptAngles: ["private birthday party, clean indoor party setup, cheerful families"],
    preferredImageKeywords: ["private", "party", "birthday", "facility", "indoor"],
  },
];

export function getSocialCampaign(id: string | null | undefined): SocialCampaign | null {
  return SOCIAL_CAMPAIGNS.find((campaign) => campaign.id === id) ?? null;
}
