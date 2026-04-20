import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";
import Sidebar from "@/components/shared/sidebar";
import Topbar from "@/components/shared/topbar";

export const metadata: Metadata = {
  title: "Agentic Room",
  description: "Multi-agent collaboration platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {/* Sidebar: fixed on desktop, slide-in on mobile */}
          <Sidebar />

          {/* Main content area — offset by sidebar width on desktop */}
          <div className="flex min-h-screen flex-col md:pl-60">
            {/* Top bar */}
            <Topbar />

            {/* Page content */}
            <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
