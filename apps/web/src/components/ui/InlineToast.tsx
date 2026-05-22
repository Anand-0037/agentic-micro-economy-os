type InlineToastProps = {
  message: string;
  variant: "ok" | "error";
};

export function InlineToast({ message, variant }: InlineToastProps) {
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-xs font-medium ${
        variant === "ok"
          ? "border border-ok/30 bg-ok/10 text-ok"
          : "border border-danger/30 bg-danger/5 text-danger"
      }`}
    >
      {message}
    </p>
  );
}
