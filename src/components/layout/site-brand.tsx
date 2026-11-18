import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteBrand() {
  return (
    <Link className="brand" href="/" aria-label={`${siteConfig.name} home`}>
      <Image
        src="/brand/logo.png"
        alt={`${siteConfig.name} logo`}
        width={32}
        height={20}
        className="brand-logo h-5 w-auto"
        priority
      />
      <span>{siteConfig.name}</span>
    </Link>
  );
}
