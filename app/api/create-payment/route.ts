import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const products: Record<string, { name: string; amount: number }> = {
  starter: {
    name: "Starter Learning Pack",
    amount: 4900,
  },
  advanced: {
    name: "Advanced Learning Pack",
    amount: 14900,
  },
  premium: {
    name: "Premium Resource Bundle",
    amount: 21900,
  },
};

export async function POST(req: Request) {
  try {
    const { email, productId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const product = products[productId];

    if (!product) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "ideal", "bancontact"],

      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: product.name,
            },
            unit_amount: product.amount,
          },
          quantity: 1,
        },
      ],

      customer_email: email,

      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/product/${productId}`,

      metadata: {
        productId,
        productName: product.name,
        customerEmail: email,
      },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    );
  }
}