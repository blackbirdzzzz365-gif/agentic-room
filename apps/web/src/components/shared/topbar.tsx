"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/rooms": "Rooms",
  "/admin": "Admin",
  "/docs": "Docs",
};

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match longest prefix
  const match = Object.keys(PAGE_TITLES)
    .filter((key) => key !== "/" && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : "Agentic Room";
}

interface TopbarProps {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch for theme icon
  useEffect(() => {
    setMounted(true);
  }, []);

  const title = resolveTitle(pathname);

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-sm px-4">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="rounded-md p-1.5 hover:bg-secondary md:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <h1 className="flex-1 text-sm font-semibold text-foreground md:text-base">
        {title}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "rounded-md p-1.5 transition-colors hover:bg-secondary",
            !mounted && "invisible"
          )}
          aria-label="Toggle theme"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* User avatar */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none"
          aria-label="User account"
        >
          AR
        </div>
      </div>
    </header>
  );
}
