import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Raw material inventory has been decommissioned. Raw Material is a manual blocked-orders queue only.",
    materials: [],
  });
}
