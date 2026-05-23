import DodoPayments from "dodopayments";
import { Resend } from "resend";

export const runtime = "nodejs";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

const PRODUCT_LINKS: Record<string, string> = {
  pdt_0NejbFdEWiZuZ0NsYybwy: "https://drive.google.com/your-starter-file-link",
  pdt_0NejbNVbnt9348XguwcxN: "https://drive.google.com/your-advanced-file-link",
  pdt_0NejbUCTIjwPIhZLQ8eoa: "https://drive.google.com/your-premium-file-link",
};

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

    const email =
      data.customer?.email ||
      data.customer_email ||
      data.customer_details?.email ||
      data.metadata?.customerEmail ||
      "unknown";

    const productId =
      data.product_id ||
      data.product?.id ||
      data.product_cart?.[0]?.product_id ||
      data.metadata?.productId ||
      "unknown";

    const paymentMethod =
      data.payment_method ||
      data.payment_method_type ||
      data.payment?.method ||
      "unknown";

    const country =
      data.billing_address?.country ||
      data.billing_address?.country_code ||
      data.customer?.country ||
      data.customer_details?.country ||
      "unknown";

    const address =
      [
        data.billing_address?.line1,
        data.billing_address?.city,
        data.billing_address?.state,
        data.billing_address?.postal_code,
        country,
      ]
        .filter(Boolean)
        .join(", ") || "unknown";

    const amount =
      data.total_amount ||
      data.amount ||
      data.price ||
      "?";

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

    if (eventType === "payment.failed") {
      await sendTelegram(`❌ ОПЛАТА ОТКЛОНЕНА

Email: ${email}
Страна: ${country}
Адрес: ${address}
Метод оплаты: ${paymentMethod}
Причина: ${declineReason}
Product ID: ${productId}`);

      return Response.json({ ok: true });
    }

    if (eventType !== "payment.succeeded") {
      return Response.json({ ok: true });
    }

    await sendTelegram(`✅ ОПЛАТА УСПЕШНА

Email: ${email}
Страна: ${country}
Адрес: ${address}
Метод оплаты: ${paymentMethod}
Сумма: ${amount} ${currency}
Product ID: ${productId}`);

    if (email === "unknown" || productId === "unknown") {
      return Response.json({ ok: true });
    }

    const downloadLink = PRODUCT_LINKS[productId];

    if (!downloadLink) {
      console.log("No download link for", productId);
      return Response.json({ ok: true });
    }

    await resend.emails.send({
      from: "Holytime Learning <onboarding@resend.dev>",
      to: email,
      subject: "Your Holytime product",
      html: `
        <h2>Thank you for your purchase</h2>
        <p>Download your product here:</p>
        <a href="${downloadLink}">Download</a>
      `,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Dodo webhook error:", err);
    return new Response("Webhook error", { status: 400 });
  }
}