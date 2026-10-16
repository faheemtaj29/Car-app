"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

/** English ⇄ اردو. Stores the choice for a year and re-renders the page. */
export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="lang-switch"
      lang={lang === "en" ? "ur" : "en"}
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${lang === "en" ? "ur" : "en"}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
