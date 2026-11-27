"use client";

import Image from "next/image";
import { useState } from "react";

type TileBackgroundProps = {
  src: string;
  /** Solid colour shown while the image loads or if the file is missing. */
  fallback: string;
  /** Category-coloured wash layered over the image so copy stays readable. */
  overlay: string;
  priority?: boolean;
};

/**
 * Decorative background art for a home action tile. The image is subtle and
 * the coloured wash sits on top. If the file fails to load the fallback colour
 * remains, so the tile never turns transparent.
 */
export function TileBackground({ src, fallback, overlay, priority = false }: TileBackgroundProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span aria-hidden="true" className="tile-bg" style={{ backgroundColor: fallback }}>
      {!failed ? (
        <Image
          src={src}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 640px) 50vw, 33vw"
          className="tile-bg-image"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span className="tile-bg-overlay" style={{ background: overlay }} />
    </span>
  );
}
