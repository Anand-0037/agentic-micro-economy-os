type StatusDotProps = {
  ok: boolean | null;
};

export function StatusDot({ ok }: StatusDotProps) {
  const className =
    ok === null
      ? "bg-neutral-300"
      : ok
        ? "bg-ok"
        : "bg-danger";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      aria-hidden="true"
    />
  );
}
