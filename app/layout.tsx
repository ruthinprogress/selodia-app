import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Default metadata for the project. The landing page at / exports its own and
// overrides this; these values are what an API route or any future page inherits.
// They were still the create-next-app boilerplate until 2026-09-01, which would
// have put "Create Next App" in the browser tab of selodia.app.
export const metadata: Metadata = {
  title: "Selodía",
  description: "A body literacy app for women 40+.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
