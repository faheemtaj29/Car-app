"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  AccountingIcon,
  CarIcon,
  ChevronDownIcon,
  DashboardIcon,
  FeesIcon,
  GlobeIcon,
  InventoryIcon,
  LogoutIcon,
  MenuIcon,
  SettingsIcon,
} from "@/components/Icons";

type NavSubItem = { href: string; label: string };
type TreeKey = "dealership" | "shop" | "inventory" | "accounting";
type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  roles?: string[];
  tree?: { key: TreeKey; items: NavSubItem[] };
};
type NavGroup = { label: string; items: NavItem[] };

/** `roles` limits an entry; leaving it out means every signed-in role sees it. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", Icon: DashboardIcon }],
  },
  {
    label: "Sales",
    items: [
      {
        href: "/dealership",
        label: "Dealership",
        Icon: CarIcon,
        tree: {
          key: "dealership",
          items: [
            { href: "/dealership?tab=overview", label: "Overview" },
            { href: "/dealership?tab=inventory", label: "Cars & Bikes" },
            { href: "/dealership?tab=customers", label: "Customers & Leads" },
            { href: "/dealership?tab=deals", label: "Deals & Financing" },
            { href: "/dealership?tab=classifieds", label: "Public Ads (review)" },
          ],
        },
      },
      {
        href: "/ecommerce",
        label: "Online Shop",
        Icon: FeesIcon,
        tree: {
          key: "shop",
          items: [
            { href: "/ecommerce?tab=orders", label: "Orders" },
            { href: "/ecommerce?tab=products", label: "Products" },
            { href: "/ecommerce?tab=coupons", label: "Coupons" },
            { href: "/ecommerce?tab=settings", label: "Shop Settings" },
          ],
        },
      },
    ],
  },
  {
    label: "Stock & Money",
    items: [
      {
        href: "/inventory",
        label: "Parts Inventory",
        Icon: InventoryIcon,
        tree: {
          key: "inventory",
          items: [
            { href: "/inventory?tab=vouchers&node=inventory-dashboard", label: "Dashboard" },
            { href: "/inventory?tab=products&node=products", label: "Products" },
            { href: "/inventory?tab=vouchers&type=purchase&node=purchase", label: "Purchase" },
            { href: "/inventory?tab=vouchers&type=sales&node=sales", label: "Sales" },
            { href: "/inventory?tab=vouchers&type=adjustment&node=stock-adjustment", label: "Stock Adjustment" },
            { href: "/inventory?tab=vouchers&type=transfer&node=stock-transfer", label: "Branch Transfer" },
            { href: "/inventory?tab=vouchers&node=inventory-reports", label: "Reports" },
          ],
        },
      },
      {
        href: "/accounting",
        label: "Accounting",
        Icon: AccountingIcon,
        roles: ["admin"],
        tree: {
          key: "accounting",
          items: [
            { href: "/accounting?tab=overview&node=accounting-dashboard", label: "Dashboard" },
            { href: "/accounting?tab=vouchers&type=receipt&mode=cash_receipt&node=crv", label: "Receipts" },
            { href: "/accounting?tab=vouchers&type=payment&mode=cash_payment&node=cpv", label: "Payments" },
            { href: "/accounting?tab=vouchers&type=journal&node=jv", label: "Journal Entry" },
            { href: "/accounting?tab=coa&node=chart-of-accounts", label: "Chart of Accounts" },
            { href: "/accounting?tab=ledger&node=general-ledger", label: "General Ledger" },
            { href: "/accounting?tab=trial&node=trial-balance", label: "Trial Balance" },
            { href: "/accounting?tab=pnl&node=income-statement", label: "Profit & Loss" },
            { href: "/accounting?tab=balance&node=balance-sheet", label: "Balance Sheet" },
          ],
        },
      },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", Icon: SettingsIcon, roles: ["admin"] }],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  children,
  user,
  businessName,
}: {
  children: ReactNode;
  user: { name: string; email: string; role: string };
  businessName: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
  const [branch, setBranch] = useState("");
  const [expanded, setExpanded] = useState<Record<TreeKey, boolean>>({
    dealership: false,
    shop: false,
    inventory: false,
    accounting: false,
  });
  const role = (user.role || "").toLowerCase();

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded((prev) => ({
      dealership: prev.dealership || pathname.startsWith("/dealership"),
      shop: prev.shop || pathname.startsWith("/ecommerce"),
      inventory: prev.inventory || pathname.startsWith("/inventory"),
      accounting: prev.accounting || pathname.startsWith("/accounting"),
    }));
  }, [pathname]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const list = d.settings?.branches || [];
        setBranches(list);
        let saved = "";
        try {
          saved = localStorage.getItem("am_branch") || "";
        } catch {
          /* storage blocked */
        }
        setBranch(saved || d.settings?.defaultBranchCode || list[0]?.code || "");
      })
      .catch(() => undefined);
  }, []);

  function switchBranch(code: string) {
    setBranch(code);
    try {
      localStorage.setItem("am_branch", code);
    } catch {
      /* storage blocked */
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function hrefActive(href: string) {
    const [path, rawQuery = ""] = href.split("?");
    if (!(pathname === path || pathname.startsWith(`${path}/`))) return false;
    if (!rawQuery) return pathname === path;
    for (const [key, value] of new URLSearchParams(rawQuery).entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  function renderTree(item: NavItem) {
    const tree = item.tree!;
    const isOpen = expanded[tree.key];
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <div className="nav-tree-wrap" key={item.href}>
        <button
          type="button"
          className={`nav-item nav-tree-btn${isActive ? " active" : ""}`}
          onClick={() => setExpanded((prev) => ({ ...prev, [tree.key]: !prev[tree.key] }))}
        >
          <item.Icon />
          <span>{item.label}</span>
          <ChevronDownIcon className={`tree-caret${isOpen ? " open" : ""}`} />
        </button>
        {isOpen ? (
          <div className="nav-subtree">
            <div className="nav-subsection">
              {tree.items.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`nav-subitem${hrefActive(sub.href) ? " active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">
          <div className="brand-badge">{initials(businessName) || "A"}</div>
          <div className="brand-text">
            {businessName}
            <small>DEALER BACK OFFICE</small>
          </div>
        </div>

        <div className="nav-scroll">
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                if (item.tree) return renderTree(item);
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`} onClick={() => setOpen(false)}>
                    <item.Icon />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="nav-group">
            <div className="nav-label">Website</div>
            <a href="/" target="_blank" rel="noreferrer" className="nav-item">
              <GlobeIcon />
              View public site ↗
            </a>
          </div>
        </div>

        <div className="sidebar-foot">
          <div className="avatar">{initials(user.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="who">{user.name}</div>
            <div className="role">{user.role}</div>
          </div>
          <button type="button" className="logout-btn" onClick={logout} title="Sign out">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="menu-btn" onClick={() => setOpen((v) => !v)}>
              <MenuIcon />
            </div>
            <b style={{ fontSize: 14 }}>{businessName}</b>
          </div>
          <div className="topbar-right">
            {branches.length > 1 ? (
              <div className="campus-switch" style={{ padding: 0, overflow: "hidden" }}>
                <select
                  aria-label="Branch"
                  value={branch}
                  onChange={(e) => switchBranch(e.target.value)}
                  style={{ border: 0, background: "transparent", font: "inherit", padding: "8px 28px 8px 12px", cursor: "pointer", color: "inherit", appearance: "none", minWidth: 120 }}
                >
                  {branches.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
                <ChevronDownIcon style={{ width: 13, height: 13, position: "absolute", right: 10, pointerEvents: "none" }} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="content">{children}</div>
      </div>

      <div className={`sidebar-overlay${open ? " open" : ""}`} onClick={() => setOpen(false)} />
    </div>
  );
}
