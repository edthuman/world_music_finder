import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: "World Music Finder",
  description: "A place to discover new music from around the world.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full has-[.settings-page]:scheme-light has-[.settings-page]:bg-page"
    >
      <body className="flex h-svh min-h-[560px] flex-col has-[.settings-page]:scheme-light has-[.settings-page]:bg-page">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
