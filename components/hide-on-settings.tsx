"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function HideOnSettings({ children }: { children: ReactNode }) {
  return usePathname() === "/settings" ? null : children;
}
