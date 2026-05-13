import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DODO_PRODUCT_IDS: Record<string, string> = {
  starter: "pdt_0Nejk64sUSamH5UNL2Ktw",
  advanced: "pdt_0NejkFOBCGn3V16i67R5T",
  premium: "pdt_0NejkOL94xZvv7363UZMW",
};

export async function POST(req: Request) {
  try {
    const { email, productId } = await req.json();

    if (!email || !productId) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const dodoProductId = DODO_PRODUCT_IDS[productId];

    if (!dodoProductId) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!apiKey || !siteUrl) {
      return NextResponse.json({ error: "Missing env" }, { status: 500 });
    }

    const res = await fetch("https://live.dodopayments.com/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: dodoProductId,
            quantity: 1,
          },
        ],
        customer: {
          email,
          name: email,
        },
        billing: {
          city: "Kyiv",
          country: "UA",
          state: "Kyiv",
          street: "Kyiv",
          zipcode: "01001",
        },
        return_url: `${siteUrl}/success`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Dodo error:", data);
      return NextResponse.json(
        { error: "Dodo failed", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      checkoutUrl: data.payment_link || data.checkout_url || data.url,
    });
  } catch (error) {
    console.error("Dodo checkout error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}