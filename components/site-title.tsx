"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const title = "World Music Finder";

export default function SiteTitle() {
  if (usePathname() === "/") {
    return (
      <button type="button" className="site-title" aria-current="page">
        {title}
      </button>
    );
  }
  return (
    <Link href="/" className="site-title">
      {title}
    </Link>
  );
}
