import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  variant?: 'full' | 'mark';
  href?: string | false;
  className?: string;
  width?: number;
  height?: number;
}

// Intrinsic aspect ratio of the NPGM wordmark (LogoNew.png is 439×117).
const FULL_RATIO = 439 / 117;

/**
 * NPGM brand logo.
 *  - variant="full": horizontal wordmark "NPGM — Advanced Mining Equipment" (default).
 *  - variant="mark": square brand mark only (favicon, app icon, tight slots).
 * The wordmark always keeps its aspect ratio: pass either width OR height and
 * the other is derived, so existing call sites can't distort it.
 */
export default function Logo({
  variant = 'full',
  href = '/',
  className,
  width,
  height,
}: LogoProps) {
  const src = variant === 'mark' ? '/logo-mark.png' : '/LogoNew.png';

  let w: number;
  let h: number;
  if (variant === 'mark') {
    h = height ?? width ?? 32;
    w = h;
  } else if (width) {
    w = width;
    h = Math.round(width / FULL_RATIO);
  } else if (height) {
    h = height;
    w = Math.round(height * FULL_RATIO);
  } else {
    w = 150;
    h = Math.round(150 / FULL_RATIO);
  }

  const img = (
    <Image
      src={src}
      alt="NPGM — Advanced Mining Equipment"
      width={w}
      height={h}
      priority
      className={className}
    />
  );

  if (href === false) return img;
  return (
    <Link href={href} aria-label="NPGM home">
      {img}
    </Link>
  );
}
