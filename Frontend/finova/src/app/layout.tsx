import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/pages/Navbar";
import { AppProviders } from "@/components/providers/AppProviders";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finova Data Quality Platform",
  description: "Ontology-driven data quality insights and trends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 antialiased text-slate-900`}>
        <AppProviders>
          <Navbar />
          <main className="min-h-screen pt-24 pb-12 px-4 sm:px-8">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}