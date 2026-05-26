import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY!);

const PRODUCT_LINKS: Record<string, string> = {
  starter: "https://drive.google.com/drive/folders/1gJW0fFRcY1O1JlnePnqUp2gTm8XUU9kh?usp=sharing",
  advanced: "https://drive.google.com/file/d/102z289XsEfuHbrOvPazAhWjE1VE4HgfK/view?usp=sharing",
  premium: "https://drive.google.com/drive/folders/1RqTD_vuq2LvYWH-vpQBAk2d73X6-W4ny?usp=sharing",
  product159: "https://drive.google.com/drive/folders/1elClIcBLP3FE5gtuHUFwBBWBoFfN5o6l?usp=sharing",
  product161: "https://drive.google.com/drive/folders/1baNo2BVX6oY5mYoqahy0hmbXu1wkzGbK?usp=sharing",
  product199: "https://drive.google.com/file/d/1ZHHXBAZ3Gu8oHkp2B215MkUl5IXtEqft/view?usp=sharing",
};

const PRODUCT_NAMES: Record<string, string> = {
  starter: "Starter Pack",
  advanced: "Advanced Pack",
  premium: "Premium Bundle",
  product159: "Essential Pack",
  product161: "Professional Pack",
  product199: "Elite Pack",
};

const processedEvents = new Set<string>();

async function sendTelegram(text: string, sourceDomain: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const chatId = sourceDomain.includes("holytime.business")
    ? "-1003983054033"
    : "-1003808961913";

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
    const event = await req.json();

    const eventType = event.type;
    const data: any = event.data || {};

    const paymentId =
      data.id ||
      data.order_id ||
      data.checkout_id ||
      event.id ||
      "unknown";

    const metadata = data.metadata || {};

    const sourceDomain =
      metadata.sourceDomain ||
      req.headers.get("host") ||
      "holytime.space";

    const eventKey = `${eventType}_${paymentId}_${sourceDomain}`;

    if (processedEvents.has(eventKey)) {
      return new Response("OK", { status: 200 });
    }

    processedEvents.add(eventKey);

    const status = data.status || "paid";

    const productId =
      metadata.productId ||
      data.product_id ||
      data.product?.id ||
      data.products?.[0]?.id ||
      "unknown";

    const productName =
      PRODUCT_NAMES[productId] ||
      data.product?.name ||
      data.products?.[0]?.name ||
      metadata.productName ||
      "Digital product";

    const email =
      data.customer_email ||
      data.customer?.email ||
      data.customer_details?.email ||
      metadata.email ||
      metadata.customerEmail ||
      "unknown";

    const addressData =
      data.billing_address ||
      data.customer?.billing_address ||
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
      "card";

    const rawAmount =
      data.total_amount ||
      data.amount ||
      data.subtotal_amount ||
      0;

    const amount = rawAmount ? (rawAmount / 100).toFixed(2) : "?";

    const currency =
      data.currency ||
      data.currency_code ||
      "EUR";

    const declineReason =
      data.error_code ||
      data.error_message ||
      data.failure_reason ||
      data.decline_reason ||
      status ||
      "unknown";

    const date = data.created_at
      ? new Date(data.created_at).toLocaleString("en-GB")
      : new Date().toLocaleString("en-GB");

    if (
      eventType === "order.failed" ||
      eventType === "checkout.failed" ||
      eventType === "payment.failed"
    ) {
      await sendTelegram(`⚠️ <b>POLAR PAYMENT FAILED</b>

🌐 <b>Website:</b> ${sourceDomain}

👤 <b>Email:</b> ${email}
📦 <b>Product:</b> ${productName}
💰 <b>Amount:</b> ${amount} ${currency}
💳 <b>Payment:</b> ${paymentMethod}
🌍 <b>Country:</b> ${country}
📍 <b>Address:</b> ${address}
⚠️ <b>Reason:</b> ${declineReason}
🧾 <b>ID:</b> ${paymentId}
🕒 <b>Date:</b> ${date}`, sourceDomain);

      return new Response("OK", { status: 200 });
    }

    if (eventType !== "order.paid") {
      return new Response("OK", { status: 200 });
    }

    await sendTelegram(`💸 <b>POLAR PAYMENT SUCCESSFUL</b>

🌐 <b>Website:</b> ${sourceDomain}

👤 <b>Email:</b> ${email}
📦 <b>Product:</b> ${productName}
💰 <b>Amount:</b> ${amount} ${currency}
💳 <b>Payment:</b> ${paymentMethod}
🌍 <b>Country:</b> ${country}
📍 <b>Address:</b> ${address}
🧾 <b>ID:</b> ${paymentId}
🕒 <b>Date:</b> ${date}`, sourceDomain);

    const downloadLink = PRODUCT_LINKS[productId];

    if (!downloadLink || email === "unknown") {
      return new Response("OK", { status: 200 });
    }

    await resend.emails.send({
      from: "Holytime <support@holytime.space>",
      to: email,
      subject: `Your product: ${productName}`,
      html: `
        <h2>Thank you for your purchase 💜</h2>
        <p>Your product is ready:</p>
        <p><strong>${productName}</strong></p>

        <p>
          <a href="${downloadLink}"
          style="display:inline-block;padding:12px 20px;
          background:#6541df;color:white;border-radius:8px;
          text-decoration:none;font-weight:bold;">
          Download your product
          </a>
        </p>
      `,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Polar webhook error:", err);
    return new Response("OK", { status: 200 });
  }
}