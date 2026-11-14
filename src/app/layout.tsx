import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Teacher Lesson AI",
  description: "教員向け授業準備支援の開発用スケルトン",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
