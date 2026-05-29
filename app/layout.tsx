import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Shopping Search Term Analyzer",
  description: "Analyze Google Ads Search Term reports, identify wasted spend, and generate negative keyword recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
