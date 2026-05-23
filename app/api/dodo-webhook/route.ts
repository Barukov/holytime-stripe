import DodoPayments from "dodopayments";
import { Resend } from "resend";

export const runtime = "nodejs";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

const PRODUCT_LINKS: Record<string, string> = {
  starter: "https://drive.google.com/your-starter-file-link",
  advanced: "https://drive.google.com/your-advanced-file-link",
  premium: "https://drive.google.com/your-premium-file-link",
};

const processedEvents = new Set<string>();

async function sendTelegram(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const event = await dodo.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
      },
    });

    const eventType = event.type;
    const data: any = event.data || {};

    console.log("DODO EVENT:", eventType);
    console.log("DODO DATA:", JSON.stringify(data, null, 2));

    const transactionId =
      data.id ||
      data.transaction_id ||
      data.payment_id ||
      "unknown";

    if (processedEvents.has(transactionId)) {
      return new Response("OK", { status: 200 });
    }

    processedEvents.add(transactionId);

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
      ]
        .filter(Boolean)
        .join(", ") || "unknown";

    const paymentMethod =
      data.payment_method ||
      data.payment_method_type ||
      "unknown";

    const amount =
      data.total_amount ||
      data.amount ||
      "?";

    const currency =
      data.currency ||
      data.currency_code ||
      "";

    const declineReason =
      data.error_code ||
      data.error_message ||
      data.failure_reason ||
      data.status ||
      "unknown";

    const date = data.created_at
      ? new Date(data.created_at).toLocaleString("en-GB")
      : new Date().toLocaleString("en-GB");

    if (eventType === "payment.failed") {
      await sendTelegram(`❌ <b>PAYMENT FAILED</b>
🌐 <b>Website:</b> holytime.space

👤 <b>Email:</b> ${email}
📦 <b>Product:</b> ${productName}
💳 <b>Payment:</b> ${paymentMethod}
🌍 <b>Country:</b> ${country}
📍 <b>Address:</b> ${address}
⚠️ <b>Reason:</b> ${declineReason}
🧾 <b>ID:</b> ${transactionId}
🕒 <b>Date:</b> ${date}`);

      return new Response("OK", { status: 200 });
    }

    if (eventType !== "payment.succeeded") {
      return new Response("OK", { status: 200 });
    }

    await sendTelegram(`💸 <b>PAYMENT SUCCESSFUL</b>
🌐 <b>Website:</b> holytime.space

👤 <b>Email:</b> ${email}
📦 <b>Product:</b> ${productName}
💰 <b>Amount:</b> ${amount} ${currency}
💳 <b>Payment:</b> ${paymentMethod}
🌍 <b>Country:</b> ${country}
📍 <b>Address:</b> ${address}
🧾 <b>ID:</b> ${transactionId}
🕒 <b>Date:</b> ${date}`);

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