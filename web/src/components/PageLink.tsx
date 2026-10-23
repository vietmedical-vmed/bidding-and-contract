import Link from "next/link";

/** Prev/next button of a pager; renders a dimmed box when there is no page to go to. */
export function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "grid h-7 w-7 place-items-center rounded-md border border-slate-200";
  return href ? (
    <Link href={href} aria-label={label} className={`${cls} text-slate-600 hover:bg-slate-50`}>
      {children}
    </Link>
  ) : (
    <span aria-hidden className={`${cls} text-slate-300`}>
      {children}
    </span>
  );
}
