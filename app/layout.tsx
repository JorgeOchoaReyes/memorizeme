import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MemorizeMe | The Ultimate Memorization & Study Tool",
  description: "Improve your memory and study efficiency with MemorizeMe. Practice recalling text, speeches, and paragraphs using typing and voice-to-text. The best free active recall app for students and professionals.",
  keywords: ["memorization", "study tool", "memory typing", "learn lines", "speech practice", "memorize text", "active recall", "MemorizeMe", "study helper", "memory training"],
  authors: [{ name: "MemorizeMe Team" }],
  openGraph: {
    title: "MemorizeMe | The Ultimate Memorization & Study Tool",
    description: "The best free active recall app for students and professionals.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
