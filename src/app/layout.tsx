import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "돌봄매트 견적 문의 | 프리미엄 층간소음 솔루션",
  description: "돌봄매트 간편 견적 신청 페이지입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
