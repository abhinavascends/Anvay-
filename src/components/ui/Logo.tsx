import Image from "next/image";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/anvay.png"
      alt="Anvay"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      priority
    />
  );
}
