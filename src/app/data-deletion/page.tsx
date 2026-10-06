import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/legal/PolicyPageLayout";

export const metadata: Metadata = {
  title: "Data Deletion Instructions",
  description: "How to request deletion of information held by Jumping Jax LLC.",
  alternates: { canonical: "/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <PolicyPageLayout title="Data Deletion Instructions" current="data-deletion">
      <p>To request deletion of information held by Jumping Jax LLC, email <a href="mailto:jumpingjaxllc@yahoo.com?subject=Data%20deletion%20request">jumpingjaxllc@yahoo.com</a> with the subject <strong>Data deletion request</strong>.</p>
      <ol><li>Tell us your name and the email address or phone number used with Jumping Jax.</li><li>Describe the information you want reviewed, such as a booking, invitation or RSVP, giveaway entry, WhatsApp inquiry or recording, or a connected Meta business integration. Include an existing booking reference if you have one.</li><li>For Meta integration records, identify the business or Page name and your relationship to that account. Do not send passwords, access tokens, payment-card details, or identity documents in the initial request.</li></ol>
      <p>We will review the request, verify authority when needed, and respond with the outcome or any additional information required. Information that must be retained for a business record, dispute, or applicable obligation may not be removed; we will explain that when responding. Requests for data held independently by Meta or another provider must be directed to that provider.</p>
      <p>You may separately remove the app&apos;s permissions in Meta&apos;s account or business integration settings to stop future authorized access.</p>
    </PolicyPageLayout>
  );
}

