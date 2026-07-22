import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prodocu — AI Project Documentation",
  description: "Turn any GitHub repo or codebase into professional documentation, powered by Prodocu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
