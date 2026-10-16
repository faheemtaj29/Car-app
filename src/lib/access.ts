/** Back-office page access by role (enforced in the proxy). APIs check roles themselves. */
const ADMIN_ONLY = ["/accounting", "/settings"];

export function canOpenPage(role: string, pathname: string) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return true;
  if (r !== "staff") return false;
  return !ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
