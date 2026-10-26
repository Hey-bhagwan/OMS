import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koa Living — Order Management System",
  description: "Production-ready centralized OMS for Koa Living: Uniware, Shiprocket, and Inventory Workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#faf9f8] text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
