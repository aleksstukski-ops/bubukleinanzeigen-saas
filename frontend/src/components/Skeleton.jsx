/**
 * Reusable skeleton placeholders for loading states. The shimmer
 * animation lives in src/styles/index.css (.skeleton-shimmer) so it
 * stays JS-free and obeys prefers-reduced-motion.
 *
 * - <SkeletonBlock>: a single sized rectangle
 * - <SkeletonText>:  N text lines, last line shorter
 * - <SkeletonCard>:  a card-shaped block with optional avatar + lines
 * - <SkeletonList>:  N copies of SkeletonCard, stacked
 */

function SkeletonBlock({ className = "", style = {}, ...rest }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, lastLineWidth = "60%", className = "" }) {
  const safeLines = Math.max(1, Number(lines) || 1);
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: safeLines }).map((_, i) => {
        const isLast = i === safeLines - 1;
        return (
          <SkeletonBlock
            key={i}
            className="h-3"
            style={{ width: isLast && safeLines > 1 ? lastLineWidth : "100%" }}
          />
        );
      })}
    </div>
  );
}

export function SkeletonCard({ withAvatar = false, lines = 2, className = "" }) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        {withAvatar && (
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-full" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-4" style={{ width: "55%" }} />
          <SkeletonText lines={lines} lastLineWidth="40%" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, withAvatar = false, lines = 2, className = "" }) {
  const safeCount = Math.max(1, Number(count) || 1);
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: safeCount }).map((_, i) => (
        <SkeletonCard key={i} withAvatar={withAvatar} lines={lines} />
      ))}
    </div>
  );
}

export { SkeletonBlock };
export default SkeletonCard;
