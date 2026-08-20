import { buildAbsoluteUrl, getCanonicalSiteUrl } from "@/lib/site-url";

export type BirthdayCouponEmailInput = {
  childFirstName?: string | null;
  couponPercent?: number;
  siteUrl?: string;
};

export function birthdayCouponSubject(input: BirthdayCouponEmailInput): string {
  const name = input.childFirstName?.trim();
  return name
    ? `${name}'s birthday is coming up`
    : "A birthday is coming up";
}

export function birthdayCouponText(input: BirthdayCouponEmailInput): string {
  const name = input.childFirstName?.trim();
  const percent = input.couponPercent ?? 20;
  const facilityPartiesUrl = buildAbsoluteUrl(
    "/facility-parties",
    input.siteUrl ?? getCanonicalSiteUrl(),
  );
  const opener = name
    ? `Hi from Jumping Jax,\n\n${name}'s birthday is coming up, and we would love to help make the party easy and fun.`
    : "Hi from Jumping Jax,\n\nA birthday is coming up, and we would love to help make the party easy and fun.";

  return `${opener}

Here is ${percent}% off a birthday party at Jumping Jax.

You can view party details here:
${facilityPartiesUrl}

To redeem it, reply to this email or call Jumping Jax and mention this email when booking.

Thanks,
Jumping Jax`;
}
