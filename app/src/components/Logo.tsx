import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  variant?: 'full' | 'mark';
  href?: string | false;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * NPGM brand logo.
 *  - variant="full": wordmark "NPGM Service App" + brand mark (default).
 *  - variant="mark": square mark only (use in tight nav slots, favicon, app icon).
 * If `href` is given (or omitted, defaults to "/"), wraps the logo in a Link.
 * Pass `href={false}` to render as a plain inline image (e.g. inside an existing link).
 */
export default function Logo({
  variant = 'full',
  href = '/',
  className,
  width,
  height,
}: LogoProps) {
  const src = variant === 'mark' ? '/logo-mark.svg' : '/logo.svg';
  const intrinsicWidth = variant === 'mark' ? 32 : 200;
  const intrinsicHeight = variant === 'mark' ? 32 : 40;

  const img = (
    <Image
      src={src}
      alt="NPGM Service App"
      width={width ?? intrinsicWidth}
      height={height ?? intrinsicHeight}
      priority
      className={className}
    />
  );

  if (href === false) return img;
  return (
    <Link href={href} aria-label="NPGM Service App home">
      {img}
    </Link>
  );
}
