import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import RouteLoaderProvider from "@/components/RouteLoader";

import "./globals.css";

// Single site-wide font (client requirement) — used for both body text and
// headings via the shared --font-roboto variable (see globals.css).
const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://utsavevents.live"),
  title: "Utsav Events — Sacred Experiences in Music & Devotion",
  description:
    "Bangalore-based cultural organisation bringing communities together through the timeless power of music and devotion. Book seats for Rudrotsav and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RouteLoaderProvider>{children}</RouteLoaderProvider>
      </body>
    </html>
  );
}
