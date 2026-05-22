type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200/80 dark:bg-neutral-700/60 ${className}`}
      aria-hidden="true"
    />
  );
}
