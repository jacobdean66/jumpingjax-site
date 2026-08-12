export type FaqAnswer = {
  id: string;
  topics: string[];
  answer: string;
};

export const BUSINESS_FAQ: FaqAnswer[] = [
  {
    id: "hours-location",
    topics: ["hours", "open", "location", "address", "where"],
    answer:
      "Jumping Jax serves the Greenwood, SC area with inflatable rentals and open play. For current hours and the best contact path, I can also transfer you to a team member.",
  },
  {
    id: "rentals-overview",
    topics: ["rental", "bounce", "inflatable", "deliver", "delivery"],
    answer:
      "We deliver and set up inflatable rentals for parties and events. I can check rental availability and submit a pending request for Jumping Jax to confirm. Final pricing is confirmed by the team.",
  },
  {
    id: "waiver",
    topics: ["waiver", "sign", "permission"],
    answer:
      "Open-play guests need a signed waiver. You can complete the native waiver online before your visit. I cannot collect card details on this call.",
  },
  {
    id: "payment",
    topics: ["pay", "payment", "deposit", "card", "cash"],
    answer:
      "I never collect card numbers on this call. When appropriate, I can send a secure simulated payment or deposit link, or explain that payment is arranged with Jumping Jax after your request is confirmed.",
  },
  {
    id: "human",
    topics: ["human", "person", "manager", "jacob", "staff", "transfer"],
    answer:
      "Absolutely — I can connect you with a person. Just say you want a human and I will transfer or arrange a callback.",
  },
];

export function answerFaq(question: string): FaqAnswer {
  const lower = question.toLowerCase();
  for (const entry of BUSINESS_FAQ) {
    if (entry.topics.some((topic) => lower.includes(topic))) {
      return entry;
    }
  }
  return {
    id: "fallback",
    topics: [],
    answer:
      "I can help with rental questions, check availability, start a booking request, or connect you to a person. What would you like to do?",
  };
}
