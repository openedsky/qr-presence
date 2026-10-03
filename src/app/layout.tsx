import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Providers } from "@/components/providers";
import { connection } from "next/server";
import { headers } from "next/headers";
import { PwaRegister } from "@/components/pwa-register";
import { themeCss } from "@/server/services/theme";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "SODEFOR Présences",
    template: "%s · SODEFOR Présences",
  },
  description: "Gestion intelligente des réunions et des listes de présence par QR Code.",
  applicationName: "SODEFOR Présences",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Rendu à la demande : la politique de sécurité (CSP) porte un nonce propre à chaque requête.
  await connection();
  const [theme, nonce] = await Promise.all([themeCss(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  return (
    <html lang="fr" className={`${sans.variable} ${display.variable} h-full`} suppressHydrationWarning>
      <head>{theme ? <style>{theme}</style> : null}</head>
      <body className="min-h-full antialiased">
        <Providers nonce={nonce}>
          <PwaRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
