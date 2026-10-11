import Image from "next/image";

/** Decorative approved raster; the adjacent text or link names the product. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className="atlas-brand-mark block shrink-0 object-contain"
      height={size}
      src="/android-chrome-192x192.png"
      style={{ height: size, width: size }}
      unoptimized
      width={size}
    />
  );
}
