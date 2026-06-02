import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLAR_PRODUCT_IDS: Record<string, string> = {
  starter: "4f2f7d61-1e2e-4324-95d7-a1c4f6a40d17",
  advanced: "2f6d0822-ac0b-4df9-ad96-754c605ad55c",
  premium: "0dee88b0-bea5-4285-b4d4-20511490e575",
  product159: "4b5cd9e8-dfae-4791-a362-e379ad5500fd",
  product161: "4af506f7-95d3-40dd-a6a7-14b4fae8cec7",
  product199: "5a13af76-69c0-458e-a80a-55b275273131",
};

export async function POST(req: Request) {
  try {
    const { email, productId } = await req.json();

    if (!email || !productId) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const polarProductId = POLAR_PRODUCT_IDS[String(productId)];

    if (!polarProductId) {
      return NextResponse.json({ error: "Product not configured" }, { status: 400 });
    }

    const apiKey = process.env.POLAR_PAYMENTS_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!apiKey || !siteUrl) {
      return NextResponse.json({ error: "Missing env" }, { status: 500 });
    }

    const sourceDomain = req.headers.get("host") || siteUrl;

    const res = await fetch("https://api.polar.sh/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [polarProductId],
        customer_email: email,
        success_url: `${siteUrl}/success`,
        metadata: {
          sourceDomain,
          productId,
          email,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Polar error:", data);
      return NextResponse.json({ error: "Polar failed", details: data }, { status: 500 });
    }

    return NextResponse.json({
      checkoutUrl: data.checkout_url || data.url,
    });
  } catch (error) {
    console.error("Polar checkout error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}