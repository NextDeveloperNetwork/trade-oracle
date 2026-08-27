import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TradingProvider } from "@/context/TradingContext";
import Header from "../components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trade Oracle - Neural AI Trading",
  description: "Websocket quantitative crypto algorithmic trading engine",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trade Oracle",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0c10",
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className="bg-[#0a0c10]">
        <TradingProvider>
          <Header />
          <div className="pt-20">
            {children}
          </div>
        </TradingProvider>
        <Toaster theme="dark" position="bottom-right" closeButton richColors />
      </body>
    </html>
  );
}
