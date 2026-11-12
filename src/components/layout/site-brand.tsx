import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteBrand() {
  return (
    <Link className="brand" href="/" aria-label={`${siteConfig.name} home`}>
      <Image
        src="/brand/logo.png"
        alt={`${siteConfig.name} logo`}
        width={30}
        height={30}
        className="brand-logo"
        priority
      />
      <span>{siteConfig.name}</span>
    </Link>
  );
}
