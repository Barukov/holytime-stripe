import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLAR_PRODUCT_IDS: Record<string, string> = {
  starter: "657ae4c9-c1ce-4dbc-9254-f4bc843447c1",
  advanced: "55f7d7e3-35a6-4e53-bf59-27e0b685a05f",
  premium: "6197789d-21bc-422d-951b-1bb41ef65e39",
  product159: "25e6beaf-59c7-4277-8a01-5713627bf097",
  product161: "a5d6c46e-dac2-4cb9-aad8-2c959f88b037",
  product199: "02bc46cc-46d7-4643-bb06-2ab6fdecd69a",
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