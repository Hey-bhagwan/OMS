import { NextResponse } from "next/server";
import { uniwareSyncService } from "@/server/integrations/uniware/sync";
import { getSessionUser, hasPermission } from "@/server/auth/session";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user && !hasPermission(user.role, "settings:edit") && !hasPermission(user.role, "orders:edit")) {
      return NextResponse.json({ error: "Unauthorized to trigger synchronization" }, { status: 403 });
    }

    const result = await uniwareSyncService.executeSync("MANUAL_TRIGGER");
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
