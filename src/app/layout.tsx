import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "授業案たたき台づくり（試作・mock）",
  description:
    "小学5年算数の授業案たたき台を固定テンプレートの mock で表示する試作",
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
