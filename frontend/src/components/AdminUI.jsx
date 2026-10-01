import { CheckCircle2, X } from "lucide-react";
export function AdminPageHeader({ title, description, children }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Store management</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-[#737A74]">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
export function AdminPanel({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-[#E3E5DF] bg-white ${className}`}
    >
      {children}
    </div>
  );
}
export function AdminTable({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="border-b border-[#E3E5DF] bg-[#fafbf8] text-xs uppercase tracking-wide text-[#737A74]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-5 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3E5DF]">{children}</tbody>
      </table>
    </div>
  );
}
export function AdminNotice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`mb-5 flex items-start justify-between gap-4 rounded-xl px-4 py-3 text-sm ${notice.type === "error" ? "bg-[#f8e8e3] text-[#8b4033]" : "bg-[#e7eee7] text-[#385744]"}`}
    >
      <span className="inline-flex items-center gap-2">
        {notice.type !== "error" && <CheckCircle2 size={16} />}
        {notice.text}
      </span>
      <button aria-label="Dismiss notification" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
export function AdminEmpty({ children = "No records found." }) {
  return (
    <div className="px-6 py-14 text-center text-sm text-[#737A74]">
      {children}
    </div>
  );
}
export function AdminField({ label, children, ...props }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children || <input className="field mt-2" {...props} />}
    </label>
  );
}
export function Badge({ children }) {
  return (
    <span className="inline-flex rounded-full bg-[#DCE7DE] px-2.5 py-1 text-xs font-medium capitalize text-[#385744]">
      {String(children || "—").replaceAll("_", " ")}
    </span>
  );
}
