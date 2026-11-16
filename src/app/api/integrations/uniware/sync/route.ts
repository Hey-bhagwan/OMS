import { NextResponse } from "next/server";
import { uniwareSyncService } from "@/server/integrations/uniware/sync";
import { getSessionUser, hasPermission } from "@/server/auth/session";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission(user.role, "settings:edit") && !hasPermission(user.role, "orders:edit")) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dateType = (body && typeof body === "object" && "dateType" in body)
      ? (body.dateType as "CREATED" | "UPDATED")
      : undefined;

    const fromDate = body?.fromDate || undefined;
    const toDate = body?.toDate || undefined;
    const dateRange = (fromDate || toDate) ? { fromDate, toDate } : undefined;

    const result = await uniwareSyncService.executeSync("MANUAL_TRIGGER", dateType, dateRange);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
