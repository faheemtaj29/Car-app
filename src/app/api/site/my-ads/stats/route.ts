/**
 * Seller's own ad performance: views, contacts, messages per ad.
 * Returns only their own ads — no other member's data is ever returned.
 */
import { NextResponse } from "next/server";
import { getMember } from "@/backend/lib/memberSession";
import { ClassifiedAd } from "@/backend/models/Marketplace";
import { fromServiceError, jsonOk } from "@/backend/lib/http";
import { dbConnect } from "@/backend/config/database";
import type { Doc } from "@/backend/types";
import type { IClassifiedAd } from "@/backend/models/Marketplace";

export async function GET() {
  const session = await getMember();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await dbConnect();
    const ads = await ClassifiedAd.find({ memberId: session.id, status: { $ne: "removed" } })
      .select("make model year status views contacts messages publishedAt expiresAt listPrice photos")
      .sort({ updatedAt: -1 }).limit(50).lean<Doc<IClassifiedAd>[]>();
    return jsonOk(ads.map((a) => ({
      id: String(a._id),
      title: `${a.year} ${a.make} ${a.model}`,
      status: a.status,
      listPrice: a.listPrice,
      views: a.views,
      contacts: a.contacts,
      messages: a.messages.length,
      unread: a.messages.filter((m) => !m.read).length,
      photo: a.photos[0] || null,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
    })));
  } catch (e) { return fromServiceError(e); }
}
