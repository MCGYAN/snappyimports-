import Image from 'next/image';
import Link from 'next/link';

const CATEGORY_PLACEHOLDER_BGS = [
  'bg-gradient-to-br from-brand-primary via-[#0d2747] to-[#050f1f]',
  'bg-gradient-to-br from-[#0d2747] via-brand-primary to-[#050f1f]',
  'bg-gradient-to-br from-[#1a0f08] via-brand-primary to-[#050f1f]',
  'bg-gradient-to-br from-brand-primary via-slate-900 to-slate-950',
  'bg-gradient-to-br from-slate-900 via-brand-primary to-[#050f1f]',
];

interface CategoryCardProps {
  slug: string;
  name: string;
  image?: string | null;
  index?: number;
  subtitle?: string;
}

export default function CategoryCard({
  slug,
  name,
  image,
  index = 0,
}: CategoryCardProps) {
  return (
    <Link
      href={`/shop?category=${slug}`}
      prefetch
      className="group relative aspect-square w-[72vw] max-w-[17rem] flex-none snap-start overflow-hidden rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:aspect-[4/5] sm:w-[260px] md:w-[280px] lg:w-full lg:max-w-none"
    >
      {image ? (
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 280px, 25vw"
          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div
          className={`absolute inset-0 ${CATEGORY_PLACEHOLDER_BGS[index % CATEGORY_PLACEHOLDER_BGS.length]}`}
          aria-hidden
        />
      )}

      {/* Soft bottom fade — keeps text readable without blocking the image */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
        aria-hidden
      />

      <h3 className="absolute bottom-4 left-4 right-4 font-heading text-[1.1rem] font-bold leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] sm:bottom-5 sm:left-5 md:text-[1.25rem]">
        {name}
      </h3>
    </Link>
  );
}
