"use client";

import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { FlashListener } from "./flash-listener";
import { NavigationProgress } from "./navigation-progress";

/** Pas de SessionProvider : la session est lue côté serveur, signIn / signOut fonctionnent sans lui. */
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange nonce={nonce}>
      {children}
      <Suspense fallback={null}>
        <FlashListener />
        <NavigationProgress />
      </Suspense>
    </ThemeProvider>
  );
}
