import type { Metadata } from "next";
import { Cormorant_Garamond, Lato } from "next/font/google";

import "./globals.css";

// Body — clean, readable sans (matches utsavevents.live)
const lato = Lato({
  variable: "--font-lato",
  weight: ["400", "700", "900"],
  subsets: ["latin"],
});

// Headings — elegant devotional serif
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
    <html lang="en" className={`${lato.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
