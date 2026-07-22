const STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  ingesting: "bg-amber-100 text-amber-700",
  analyzing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  ingesting: "Fetching source…",
  analyzing: "Analyzing with Prodocu…",
  completed: "Completed",
  failed: "Failed",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status] || STYLES.pending}`}>
      {LABELS[status] || status}
    </span>
  );
}
