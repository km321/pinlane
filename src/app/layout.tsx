import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pinlane — Visual feedback that becomes a board",
  description:
    "Open-source visual feedback for agencies. Clients pin comments on live sites; every note lands on your Kanban — and agents can work tickets over MCP.",
};

// DB-backed pages must not prerender at build time (Postgres isn't reachable
// inside the Railway image build).
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
