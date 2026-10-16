import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, translator, type Lang } from "@/lib/i18n";

/** Visitor's language from the cookie; English when unset. */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
