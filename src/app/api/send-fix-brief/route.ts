import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LEAD_EMAIL } from "@/lib/agencyConfig";

const RequestSchema = z.object({
  merchantName: z.string().optional().default(""),
  merchantEmail: z.string().optional().default(""),
  storeUrl: z.string().optional().default(""),
  subject: z.string().min(1).max(240),
  briefText: z.string().min(1).max(20000),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid Fix Brief payload." },
        { status: 400 }
      );
    }

    const { merchantEmail, subject, briefText } = parsed.data;
    const recipient = LEAD_EMAIL;
    const resendKey = process.env.RESEND_API_KEY?.trim();

    if (resendKey) {
      const fromAddress =
        process.env.STOREDOCTOR_FROM_EMAIL?.trim() ||
        "StoreDoctor <onboarding@resend.dev>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient],
          ...(merchantEmail.trim() && merchantEmail.includes("@")
            ? { reply_to: merchantEmail.trim() }
            : {}),
          subject,
          text: briefText,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return NextResponse.json({
          delivered: true,
          mode: "direct",
          recipient,
        });
      }
    }

    return NextResponse.json({
      delivered: false,
      mode: "client-handoff",
      recipient,
    });
  } catch {
    return NextResponse.json({
      delivered: false,
      mode: "client-handoff",
      recipient: LEAD_EMAIL,
    });
  }
}
