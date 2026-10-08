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
  // Absolute URLs for Open Graph and Twitter cards. Without it Next emits
  // relative image paths, which every scraper ignores.
  metadataBase: new URL("https://selodia.app"),
  title: "Selodía",
  description: "A body literacy app for women 40+.",
  // GOOGLE SEARCH CONSOLE, for the Play Console listing (Ruth, 2 October 2026).
  // Play requires a verified domain, Search Console is how the domain is
  // verified, and this tag is how Search Console checks it.
  //
  // IN THE ROOT LAYOUT, NOT THE LANDING PAGE, because verification is a property
  // of the site rather than of one page. app/page.tsx exports its own metadata
  // and overrides the title and description above - but Next merges metadata
  // field by field, and that page sets neither `verification` nor anything near
  // it, so this is inherited and rendered on / where Search Console looks for
  // it. Putting it on the page instead would have verified the home page and
  // quietly left every other route unverified.
  //
  // `verification.google` is Next's own field for it and renders exactly
  // <meta name="google-site-verification" content="..." />. Written as the
  // field rather than pasted as raw HTML so it survives a future <head> change.
  verification: {
    google: "amYM5jS7H0c3mKYLBYCysqrKYUjdMfCpwKiXF3lZSpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
