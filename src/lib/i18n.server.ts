import { cookies } from "next/headers";
import { CITY_COOKIE, LANG_COOKIE, isLang, translator, type Lang } from "@/lib/i18n";
import { CITIES } from "@/lib/catalog";

/** Visitor's language from the cookie; English when unset. */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}

/** The buyer's chosen city, if it is a real city in the catalogue. */
export async function getMyCity(): Promise<string | undefined> {
  const raw = decodeURIComponent((await cookies()).get(CITY_COOKIE)?.value || "");
  return CITIES.find((c) => c.toLowerCase() === raw.toLowerCase());
}
