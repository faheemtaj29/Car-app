import { redirect } from "next/navigation";
import { getSession } from "@/backend/lib/cookies";
import { settingsService } from "@/backend/services/settings.service";
import { AppShell } from "@/components/AppShell";

export default async function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const name = await settingsService
    .get()
    .then((s) => s.businessName)
    .catch(() => "Auto Marketplace");
  return (
    <AppShell user={session} businessName={name}>
      {children}
    </AppShell>
  );
}
