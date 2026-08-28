import webpush from "web-push";
import { listPushSubscriptions, removePushSubscription } from "@/lib/admin/morning-brief-push-store";

export async function sendMorningBriefPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:admin@jumpingjaxllc.com";
  if (!publicKey || !privateKey) throw new Error("Web Push VAPID keys are not configured.");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const subscriptions = await listPushSubscriptions();
  let sent = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }, JSON.stringify({
        title: "Jumping Jax Morning Brief",
        body: "Today's focus is ready. Tap to review the items that need attention.",
        url: "/admin",
      }));
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await removePushSubscription(subscription.endpoint);
        removed += 1;
      }
    }
  }
  return { ok: true, sent, removed };
}
