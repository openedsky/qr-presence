import { qrLogoLayout } from "@/lib/qr-logo";
import { cn } from "@/lib/utils";

export type QrLogo = { dataUrl: string; width: number; height: number };

/** QR code avec le logo de la structure incrusté au centre sur un badge blanc arrondi. */
export function QrWithLogo({
  src,
  logo,
  alt = "QR Code de présence",
  className,
}: {
  src: string;
  logo?: QrLogo | null;
  alt?: string;
  className?: string;
}) {
  const layout = logo ? qrLogoLayout(logo.width, logo.height) : null;
  return (
    <div className={cn("relative", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full" />
      {logo && layout ? (
        <span
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white shadow-[0_0_0_2px_#fff,0_2px_8px_rgba(11,61,36,0.18)] ring-1 ring-black/5"
          style={{ width: `${layout.badgeW * 100}%`, height: `${layout.badgeH * 100}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.dataUrl}
            alt=""
            className="rounded-md object-contain"
            style={{ width: `${(layout.logoW / layout.badgeW) * 100}%`, height: `${(layout.logoH / layout.badgeH) * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}
