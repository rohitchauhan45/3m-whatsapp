import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export type EntitySummaryCardMetaRow = {
  icon: ElementType;
  iconClassName?: string;
  content: ReactNode;
};

export type EntitySummaryCardProps = {
  href?: string;
  onClick?: () => void;
  icon?: ElementType;
  /** Shows inside the leading circle instead of an icon (e.g. task code "1", "2"). */
  leadingLabel?: string;
  iconBgClassName?: string;
  title: string;
  subtitle?: ReactNode;
  metaRows?: EntitySummaryCardMetaRow[];
  footer?: string;
  showOptionsButton?: boolean;
  /** Top-right label in the card header (e.g. total task count). */
  headerEnd?: ReactNode;
  className?: string;
};

const cardClassName =
  'block rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30';

export default function EntitySummaryCard({
  href,
  onClick,
  icon: Icon,
  leadingLabel,
  iconBgClassName = 'bg-slate-500',
  title,
  subtitle,
  metaRows = [],
  footer,
  showOptionsButton = false,
  headerEnd,
  className = '',
}: Readonly<EntitySummaryCardProps>) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBgClassName}`}
          >
            {leadingLabel ? (
              <span className="text-[18px] font-semibold leading-none text-white tabular-nums">
                {leadingLabel}
              </span>
            ) : Icon ? (
              <Icon size={22} className="text-white" strokeWidth={2} />
            ) : null}
          </div>
          <div className="min-w-0">
            <h3 className="text-[20px] font-semibold text-slate-700 leading-tight truncate">
              {title}
            </h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {headerEnd && (
            <span className="text-sm font-medium text-gray-500 tabular-nums">{headerEnd}</span>
          )}
          {showOptionsButton && (
            <button
              type="button"
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
              aria-label="Options"
              onClick={(event) => event.preventDefault()}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </div>
      </div>

      {metaRows.length > 0 && (
        <div className="space-y-4 border-t border-gray-100 px-7 py-4">
          {metaRows.map((row, index) => {
            const RowIcon = row.icon;
            return (
              <div key={`meta-${index}`} className="flex items-start gap-3">
                <RowIcon
                  size={20}
                  className={`mt-0.5 shrink-0 ${row.iconClassName ?? 'text-blue-500'}`}
                  strokeWidth={2}
                />
                <div className="min-w-0 text-[15px] leading-relaxed text-gray-700">{row.content}</div>
              </div>
            );
          })}
        </div>
      )}

      {footer && (
        <div className="border-t border-gray-100 px-6 py-3">
          <p className="text-[13px] text-gray-500">{footer}</p>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${cardClassName} ${className}`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cardClassName} w-full text-left ${className}`}>
        {content}
      </button>
    );
  }

  return <div className={`${cardClassName} ${className}`}>{content}</div>;
}
