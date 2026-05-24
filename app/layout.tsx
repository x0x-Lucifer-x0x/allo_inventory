import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Allo — Inventory & Fulfillment",
  description: "Multi-warehouse inventory management with real-time reservation system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="antialiased h-full bg-gray-50 font-sans">
        <Header />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
