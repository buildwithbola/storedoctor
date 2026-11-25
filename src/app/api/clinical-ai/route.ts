import { NextRequest } from "next/server";
import { z } from "zod";
import { streamClinicalAi } from "@/lib/ai/clinicalEngine";
import { StoreAuditReport } from "@/types/audit";

const ClinicalRequestSchema = z.object({
  mode: z.enum(["diagnosis", "copy-rewrite"]),
  customNotes: z.string().max(1000).optional(),
  report: z.record(z.any()),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = ClinicalRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response("Invalid diagnostic request payload.", { status: 400 });
    }

    const stream = await streamClinicalAi({
      report: parsed.data.report as unknown as StoreAuditReport,
      mode: parsed.data.mode,
      customNotes: parsed.data.customNotes,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Unable to generate store summary right now.", {
      status: 500,
    });
  }
}
