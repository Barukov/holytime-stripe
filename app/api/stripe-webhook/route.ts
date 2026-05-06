import Stripe from "stripe";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const PRODUCT_LINKS: Record<string, string> = {
  starter: "https://drive.google.com/your-starter-file-link",
  advanced: "https://drive.google.com/your-advanced-file-link",
  premium: "https://drive.google.com/your-premium-file-link",
};

export async function POST(req: Request) {
  try {
    console.log("STRIPE WEBHOOK HIT");

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) return new Response("No signature", { status: 400 });

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    console.log("EVENT:", event.type);

    if (event.type !== "checkout.session.completed") {
      return new Response("OK", { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const productId = session.metadata?.productId;
    const productName = session.metadata?.productName || "Digital product";
    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.customerEmail;

    if (!productId || !customerEmail) {
      console.error("Missing data:", { productId, customerEmail });
      return new Response("OK", { status: 200 });
    }

    const downloadLink = PRODUCT_LINKS[productId];

    if (!downloadLink) {
      console.error("No product link for:", productId);
      return new Response("OK", { status: 200 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Holytime Learning <onboarding@resend.dev>",
      to: customerEmail,
      subject: `Your digital product: ${productName}`,
      html: `
        <h2>Thank you for your purchase</h2>
        <p>Your digital product is ready.</p>
        <p><strong>${productName}</strong></p>
        <p><a href="${downloadLink}">Download your files here</a></p>
      `,
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response("Webhook error", { status: 400 });
  }
}