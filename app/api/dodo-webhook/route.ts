import DodoPayments from "dodopayments";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY!);

const PRODUCT_LINKS: Record<string, string> = {
  starter: "https://drive.google.com/your-starter-file-link",
  advanced: "https://drive.google.com/your-advanced-file-link",
  premium: "https://drive.google.com/your-premium-file-link",
};

const processedEvents = new Set<string>();

// 🔥 РАЗДЕЛЕНИЕ ПО ДОМЕНАМ
async function sendTelegram(text: string, host: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const chatId =
    host.includes("holytime.business")
      ? "-1003983054033" // business группа
      : "-1003808961913"; // space группа

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

// 🔥 2 webhook ключа
async function unwrapDodoWebhook(rawBody: string, headers: any) {
  const webhookKeys = [
    process.env.DODO_WEBHOOK_KEY_SPACE,
    process.env.DODO_WEBHOOK_KEY_BUSINESS,
  ].filter(Boolean);

  for (const webhookKey of webhookKeys) {
    try {
      const dodo = new DodoPayments({
        bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
        webhookKey: webhookKey!,
      });

      return await dodo.webhooks.unwrap(rawBody, { headers });
    } catch {}
  }

  throw new Error("Invalid webhook signature");
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const headers = {
      "webhook-id": req.headers.get("webhook-id") ?? "",
      "webhook-signature": req.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    };

    const event = await unwrapDodoWebhook(rawBody, headers);

    const eventType = event.type;
    const data: any = event.data || {};

    const paymentId =
      data.id ||
      data.payment_id ||
      data.transaction_id ||
      "unknown";

    const eventKey = `${eventType}_${paymentId}`;

    if (processedEvents.has(eventKey)) {
      return new Response("OK", { status: 200 });
    }
    processedEvents.add(eventKey);

    const status =
      data.status ||
      data.payment_status ||
      data.transaction_status ||
      "unknown";

    const productId =
      data.product_id ||
      data.product?.id ||
      data.product_cart?.[0]?.product_id ||
      data.metadata?.productId;

    const productName =
      data.product?.name ||
      data.metadata?.productName ||
      "Digital product";

    const email =
      data.customer?.email ||
      data.customer_email ||
      data.customer_details?.email ||
      data.metadata?.customerEmail ||
      "unknown";

    const addressData =
      data.billing_address ||
      data.customer?.address ||
      {};

    const country =
      addressData.country ||
      addressData.country_code ||
      data.customer?.country ||
      "unknown";

    const address =
      [
        addressData.line1,
        addressData.city,
        addressData.state,
        addressData.postal_code,
        country,
      ].filter(Boolean).join(", ") || "unknown";

    const paymentMethod =
      data.payment_method ||
      data.payment_method_type ||
      "unknown";

    const rawAmount = data.total_amount || data.amount || 0;

    const amount = rawAmount
      ? (rawAmount / 100).toFixed(2)
      : "?";

    const currency =
      data.currency ||
      data.currency_code ||
      "";

    const declineReason =
      data.error_code ||
      data.error_message ||
      data.failure_reason ||
      data.decline_reason ||
      data.status ||
      "unknown";

    const date = data.created_at
      ? new Date(data.created_at).toLocaleString("en-GB")
      : new Date().toLocaleString("en-GB");

    const host = req.headers.get("host") || "unknown";

    // ❌ FAILED
    if (eventType === "payment.failed") {
      if (
        status === "succeeded" ||
        status === "completed" ||
        status === "paid"
      ) {
        return new Response("OK", { status: 200 });
      }

      await sendTelegram(`⚠️ <b>PAYMENT ATTEMPT FAILED</b>

🌐 <b>Website:</b> ${host}

👤 <b>Email:</b> ${email}
📦 <b>Product:</b> ${productName}
💳 <b>Payment:</b> ${paymentMethod}
🌍 <b>Country:</b> ${country}
📍 <b>Address:</b> ${address}
⚠️ <b>Reason:</b> ${declineReason}
🧾 <b>ID:</b> ${paymentId}
🕒 <b>Date:</b> ${date}`, host);

      return new Response("OK", { status: 200 });
    }

    if (eventType !== "payment.succeeded") {
      return new Response("OK", { status: 200 });
    }

    // ✅ SUCCESS
    await sendTelegram(`💸 <b>PAYMENT SUCCESSFUL</b>

🌐 <b>Website:</b> ${host}

👤 <b>Email:</b> ${email}
📦 <b>Product:</b> ${productName}
💰 <b>Amount:</b> ${amount} ${currency}
💳 <b>Payment:</b> ${paymentMethod}
🌍 <b>Country:</b> ${country}
📍 <b>Address:</b> ${address}
🧾 <b>ID:</b> ${paymentId}
🕒 <b>Date:</b> ${date}`, host);

    const downloadLink = PRODUCT_LINKS[productId];

    if (!downloadLink || email === "unknown") {
      return new Response("OK", { status: 200 });
    }

    await resend.emails.send({
      from: "Holytime Learning <onboarding@resend.dev>",
      to: email,
      subject: `Your product: ${productName}`,
      html: `
        <h2>Thank you for your purchase</h2>
        <p>Your product is ready:</p>
        <p><strong>${productName}</strong></p>
        <a href="${downloadLink}">Download here</a>
      `,
    });

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Dodo webhook error:", err);
    return new Response("OK", { status: 200 });
  }
}