import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Music Finder",
  description: "A place to discover new music from around the world.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
