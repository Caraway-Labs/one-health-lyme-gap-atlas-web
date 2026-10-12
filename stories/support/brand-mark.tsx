import Image from "next/image";

const brandSrc = new URL(
  "../../public/android-chrome-192x192.png",
  import.meta.url
).href;

/**
 * Storybook-only mark. The production component keeps its absolute public URL.
 * An absolute `/android-chrome-192x192.png` path cannot resolve on the Pages
 * project subpath, and Storybook does not publish `public/`.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      alt=""
      aria-hidden
      className="atlas-brand-mark block shrink-0 object-contain"
      height={size}
      src={brandSrc}
      style={{ height: size, width: size }}
      unoptimized
      width={size}
    />
  );
}
