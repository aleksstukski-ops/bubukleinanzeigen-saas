export default function LoadingSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-10">
      <div className="flex items-center gap-3 rounded-full border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "var(--accent)",
            borderRightColor: "var(--accent)",
          }}
        />
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Wird geladen...
        </span>
      </div>
    </div>
  );
}
