import { redirect } from "next/navigation";
import { parseSmartQuery } from "@/lib/smartSearch";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

/** Home-page "ask" box: send the sentence to the cars or bikes page it is about. */
export default async function SmartSearchRedirect({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).ask;
  const ask = (Array.isArray(raw) ? raw[0] : raw || "").trim().slice(0, 200);
  if (!ask) redirect("/cars");
  const { filters } = parseSmartQuery(ask);
  redirect(`/${filters.type === "bike" ? "bikes" : "cars"}?ask=${encodeURIComponent(ask)}`);
}
