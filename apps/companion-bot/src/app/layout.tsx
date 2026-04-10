import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Companion Bot",
  description: "陪伴機器人",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
