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

    console.log("DODO EVENT:", event.type);

    const data: any = event.data;

    const email =
      data.customer?.email ||
      data.customer_email ||
      data.customer_details?.email ||
      data.metadata?.customerEmail;

    const productId =
      data.product_id ||
      data.product?.id ||
      data.product_cart?.[0]?.product_id ||
      data.metadata?.productId;

    if (!email || !productId) {
      console.log("Missing data", { email, productId });
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