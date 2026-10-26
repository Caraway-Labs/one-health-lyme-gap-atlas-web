"use client";

import Image from "next/image";
import { useState } from "react";

export function FeedDecorImage({
  eager = false,
  sizes,
  src,
}: {
  eager?: boolean;
  sizes: string;
  src: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="ux-reset-feed-image-fallback" />;
  }
  return (
    <Image
      alt=""
      className="object-cover"
      fill
      onError={() => {
        setFailed(true);
      }}
      priority={eager}
      sizes={sizes}
      src={src}
      unoptimized
    />
  );
}
