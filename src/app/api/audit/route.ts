import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAndNormalizeStoreUrl } from "@/lib/scanner/urlGuard";
import { scanShopifyStore } from "@/lib/scanner/shopifyScanner";

const AuditRequestSchema = z.object({
  url: z.string().min(1, "Store URL is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = AuditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request payload." },
        { status: 400 }
      );
    }

    const guard = validateAndNormalizeStoreUrl(parsed.data.url);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: 400 });
    }

    const report = await scanShopifyStore(guard.url);
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unable to complete store audit right now.";
    const status = message.includes("password") || message.includes("bot/WAF") ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
