"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { consumeFlash, toast } from "@/lib/alerts";

export function FlashListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const flash = consumeFlash();
    if (flash) void toast(flash.icon, flash.title, flash.text);
  }, [pathname, searchParams]);

  return null;
}
