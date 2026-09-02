import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Anvay : National Disaster Saviour",
  description:
    "Real-time disaster early-warning and resource coordination platform",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/anvay.png", sizes: "32x32", type: "image/png" },
      { url: "/anvay.png", sizes: "192x192", type: "image/png" },
      { url: "/anvay.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/anvay.png",
    apple: "/anvay.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Anvay" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
