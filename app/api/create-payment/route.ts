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

    const dodoProductId = DODO_PRODUCT_IDS[productId];

    if (!email || !dodoProductId) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Dodo API key" },
        { status: 500 }
      );
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
        },
        metadata: {
          productId,
          customerEmail: email,
        },
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
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
      checkoutUrl:
        data.payment_link || data.checkout_url || data.url,
    });
  } catch (error) {
    console.error("Dodo checkout error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}