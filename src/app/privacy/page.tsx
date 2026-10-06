import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/legal/PolicyPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Jumping Jax LLC uses information and how to contact us about privacy.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PolicyPageLayout title="Jumping Jax LLC Privacy Policy" current="privacy">
      <p>This policy explains how Jumping Jax LLC uses information in connection with our website, rental and facility-party services, and business integrations with Facebook, Instagram, and WhatsApp. It also explains how to contact us about your information.</p>
      <h2>Information you provide</h2>
      <p>When you contact us, request a booking, submit a waiver or rental agreement, enter a giveaway, or use an invitation or RSVP feature, we receive the information you submit. This may include your name, email address, phone number, delivery or event address, event date and time, rental selections, party details, guest information, messages, and signatures.</p>
      <p>Adults may provide information about children participating in an event, such as a child&apos;s name and party details. A parent or guardian can contact us about that information.</p>
      <h2>Website activity and cookies</h2>
      <p>Our website uses cookies and similar technologies for features such as staff sign-in and measurement of website activity. Google Analytics and Google Ads tags are configured to measure visits and booking leads. These services may receive browser or device information, page activity, and event information. Your browser and the relevant provider&apos;s privacy settings may offer controls for cookies and advertising measurement.</p>
      <h2>Facebook and Instagram integrations</h2>
      <p>When an authorized business administrator connects a Meta account to our business tools, the integration may receive account and asset identifiers, information about accessible Pages or professional Instagram accounts, permissions, and access credentials. Depending on the permissions granted and the features enabled, it may also receive advertising campaign information and performance metrics.</p>
      <p>We use this information to connect the intended Jumping Jax assets, report advertising performance, prepare social content, and carry out authorized publishing or scheduling workflows. Connecting a Meta account does not by itself publish a post or change an advertisement.</p>
      <h2>WhatsApp and call intake</h2>
      <p>If a WhatsApp or voice-intake integration is enabled and you contact us through it, we may receive your caller or account identifier, message or call information, and the information you provide about your inquiry. If a recording or transcription feature is enabled, the intake may include audio and a transcript. These details are used to handle the inquiry and support staff review of a booking request.</p>
      <p>A configured integration is not a statement that every calling, voicemail, recording, or transcription feature is currently available. Information handled by WhatsApp or another communication provider is also subject to that provider&apos;s policies.</p>
      <h2>How we use information</h2>
      <p>We use information to respond to inquiries, prepare quotes, arrange rentals and parties, manage deliveries, process waivers and agreements, generate and deliver invitations, handle RSVPs and giveaways, provide customer support, maintain business records, protect our systems, and measure service and advertising performance. Information relevant to an enabled automated or AI-assisted feature may be sent to the providers supporting that feature.</p>
      <h2>Service providers and sharing</h2>
      <p>Our services use providers for website hosting, data storage, email delivery, payment processing, calendar or mapping features, analytics, advertising, and AI-assisted features. These providers process information needed for the services they support. Current integrations include Vercel, Supabase, Resend, Google services, Meta services, and AI providers used by enabled features. Payment providers process payment information under their own policies.</p>
      <p>Information may also be disclosed when necessary to respond to a legal obligation, protect people or systems, or resolve a dispute. This policy does not replace a third-party provider&apos;s privacy policy.</p>
      <h2>Access and retention</h2>
      <p>Business dashboards restrict access to authorized staff according to their roles. Meta access credentials and private recording retrieval are handled by server-side services rather than displayed publicly.</p>
      <p>Retention depends on the purpose of the record. Booking, waiver, agreement, transaction, and communication records may be needed for service delivery, business administration, dispute handling, or applicable obligations. Contact us to ask about a particular record or request deletion. We will review the request and explain any information we need to retain.</p>
      <h2>Your requests and Meta permissions</h2>
      <p>You can contact us to request access to, correction of, or deletion of information held by Jumping Jax. We may need to verify that a request relates to you or to an account you are authorized to manage.</p>
      <p>A business administrator can also revoke the app&apos;s access through Meta&apos;s account or business integration settings. Revoking access stops future access allowed by those permissions; it does not automatically erase records already held by Jumping Jax. Use the deletion instructions below to request review of those records.</p>
      <h2>Contact</h2>
      <p>Jumping Jax LLC<br />559 Beaudrot Road, Greenwood, SC 29649<br /><a href="mailto:jumpingjaxllc@yahoo.com">jumpingjaxllc@yahoo.com</a><br /><a href="tel:+18649331420">864-933-1420</a></p>
      <p>We may update this policy when our services or information practices change.</p>
    </PolicyPageLayout>
  );
}

