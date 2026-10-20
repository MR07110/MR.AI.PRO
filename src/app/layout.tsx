import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MR AI",
  description: "Muhammadrasul tomonidan yaratilgan AI yordamchi",
  icons: {
    icon: [
      { url: "/favicon-32-black.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-black.png", sizes: "any", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-neutral-950 text-neutral-100 antialiased font-[family-name:var(--font-inter)] dark">
        {children}
      </body>
    </html>
  );
}
