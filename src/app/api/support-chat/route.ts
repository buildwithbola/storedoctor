import { NextRequest } from "next/server";
import { z } from "zod";
import { streamSupportChat } from "@/lib/ai/clinicalEngine";
import { BreakEvenSummary, StoreAuditReport, SupportChatMessage } from "@/types/audit";

const SupportChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
        timestamp: z.string(),
      })
    )
    .min(1),
  activeReport: z.record(z.any()).nullable().optional(),
  breakEvenSummary: z.record(z.any()).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = SupportChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response("Invalid chat request.", { status: 400 });
    }

    const stream = await streamSupportChat({
      messages: parsed.data.messages as SupportChatMessage[],
      activeReport: (parsed.data.activeReport || null) as StoreAuditReport | null,
      breakEven: (parsed.data.breakEvenSummary || null) as BreakEvenSummary | null,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Support assistant temporarily unavailable.", {
      status: 500,
    });
  }
}
