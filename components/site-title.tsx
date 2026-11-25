"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const title = "World Music Finder";
const titleClass = "text-[1.05rem] font-semibold";

export default function SiteTitle() {
  if (usePathname() === "/") {
    return (
      <button
        type="button"
        className={`${titleClass} cursor-default`}
        aria-current="page"
      >
        {title}
      </button>
    );
  }
  return (
    <Link href="/" className={`${titleClass} cursor-pointer`}>
      {title}
    </Link>
  );
}
