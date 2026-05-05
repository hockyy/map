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
  title: {
    default: "Click Map - World Region Quiz",
    template: "%s | Click Map",
  },
  description:
    "A fast full-screen world map quiz. Name highlighted regions, pan and zoom the SVG map, and share your final score.",
  applicationName: "Click Map",
  keywords: ["map quiz", "world map", "geography game", "region quiz"],
  openGraph: {
    title: "Click Map - World Region Quiz",
    description:
      "Name highlighted regions on a full-screen interactive world map.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Click Map - World Region Quiz",
    description:
      "Name highlighted regions on a full-screen interactive world map.",
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
      <body className="flex h-full min-h-0 flex-col overflow-hidden">
        {children}
      </body>
    </html>
  );
}
