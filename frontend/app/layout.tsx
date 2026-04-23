import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "做题记录系统",
  description: "Problem record system frontend scaffold"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

