import type { Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import type { ReactNode } from "react";

// viewport-fit=cover lets env(safe-area-inset-*) work on notched phones, so
// the bottom tab bar can pad itself above the home indicator
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // add
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
