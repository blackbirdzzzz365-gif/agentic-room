"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users2,
  ShieldCheck,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Rooms", href: "/rooms", icon: Users2 },
  { label: "Admin", href: "/admin", icon: ShieldCheck },
  { label: "Docs", href: "/docs", icon: BookOpen },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground"
          onClick={onClose}
        >
          ⬡ Agentic Room
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-secondary md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border" />

      {/* Nav items */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn("sidebar-nav-item", isActive && "active")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4">
        <div className="h-px bg-border mb-3" />
        <p className="text-xs text-muted-foreground">Phase 1 · v0.1.0</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:z-40 border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger trigger — rendered inside Topbar via prop, but also
          available here as a fallback floating button */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-50 rounded-md p-2 bg-card border border-border shadow-sm md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Slide-in panel */}
          <aside className="absolute inset-y-0 left-0 w-72 bg-card border-r border-border shadow-xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
