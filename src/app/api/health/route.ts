import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/backend/config/database";

export const dynamic = "force-dynamic";

/** For the hosting platform's health check: 200 only when the database answers. */
export async function GET() {
  try {
    await dbConnect();
    await mongoose.connection.db!.admin().ping();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
