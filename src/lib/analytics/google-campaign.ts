export const inflatableCampaignDraft = {
  name: "Inflatable Rentals - 15% Off",
  dailyBudget: 10,
  status: "Draft setup incomplete; launch not verified",
  displayPaths: ["inflatables", "15-percent-off"],
  language: "English",
  aiMax: false,
  textCustomization: false,
  finalUrlExpansion: false,
  finalUrl: "https://jumpingjaxllc.com/offers/inflatables-15?utm_source=google&utm_medium=cpc&utm_campaign=inflatables_15",
  network: "Google Search only",
  targeting: "People in or regularly in a 25-mile radius around Greenwood, SC, plus all of Abbeville, Anderson, Edgefield, Greenville, Laurens, Newberry, and Saluda counties",
  bidding: "Maximize clicks initially; review rental-request conversions before changing bidding",
  headlines: ["15% Off Inflatable Rentals", "Jumping Jax Rentals", "Bounce Houses in Greenwood", "Plan Your Backyard Party", "Claim Your Rental Discount", "Inflatable Obstacle Courses", "Bounce & Slide Combos", "Request Your Event Date"],
  descriptions: [
    "Save 15% on eligible inflatable rentals. Claim the offer and request your event date.",
    "Bounce houses, combos and obstacle courses in Greenwood, SC. Delivery fees excluded.",
    "Choose your inflatable online. Availability and delivery plans confirmed by Jumping Jax.",
  ],
  phraseKeywords: ["inflatable rentals greenwood sc", "bounce house rentals greenwood sc", "bounce house rentals near me", "inflatable obstacle course rental", "bounce house slide combo rental"],
  exactKeywords: ["bounce house rental", "inflatable rentals", "obstacle course rental"],
  negativeKeywords: ["jobs", "careers", "for sale", "used", "repair", "diy", "wholesale", "indoor playground", "open play", "foam party"],
} as const;

// Manual handoff record. Do not substitute an internal account identifier for a public customer ID.
export const googleAdsSetupSnapshot = {
  recordedDate: "October 22, 2026",
  ownerEmail: "karen.mcclain.jumpingjaxllc@gmail.com",
  replacementInternalId: "8586212544",
  publicCustomerId: "715-139-9909" as string | null,
  oldCustomerId: "477-299-0778",
  oldAccountStatus: "Permanently closed",
  liveCampaignStatus: "Campaign table shows no enabled campaigns and two Search drafts at $10/day; launch still pending",
  locationStatus: "Reviewed draft has the 25-mile Greenwood radius and seven full counties; presence only",
  billingStatus: "Owner submitted billing and reached account completion; bank authorization settlement not independently verified",
  advertiserVerificationStatus: "Not verified",
} as const;
