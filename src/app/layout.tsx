import type { Metadata } from "next";
import { business } from "@/config/business";
import "./globals.css";

export const metadata: Metadata = {
  title: `AI Receptionist Demo · ${business.name}`,
  description:
    "An AI receptionist that answers questions, checks availability and books appointments, with a live front-desk view.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ "--accent": business.accent } as React.CSSProperties}>{children}</body>
    </html>
  );
}
