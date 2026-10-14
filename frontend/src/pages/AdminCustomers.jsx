import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  X,
} from "lucide-react";
import useAdminNotice from "../hooks/useAdminNotice";
import api from "../services/api";
import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

const PAGE_SIZE = 10;
function apiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const message = detail
      .map((item) =>
        typeof item === "string" ? item : item?.msg || JSON.stringify(item),
      )
      .filter(Boolean)
      .join("; ");
    return message || fallback;
  }
  return fallback;
}

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN");
}

function AdminCustomers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState("");
  const [detail, setDetail] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const { notice, notify, clear } = useAdminNotice();
  const [viewLoading, setViewLoading] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const pageCount = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );

  useEffect(() => {
    let cancelled = false;

    api
      .get("/admin/customers/", {
        params: {
          ...(active !== "" ? { is_active: active } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
      })
      .then((response) => {
        if (cancelled) return;

        const customers = Array.isArray(response.data)
          ? response.data
          : [];

        setRows(customers);

        const countHeader = response.headers?.["x-total-count"];

        setTotalCount(
          countHeader !== undefined
            ? Number(countHeader)
            : customers.length
        );

        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;

        const message = apiErrorMessage(
          error,
          "Unable to load customers."
        );

        setLoadError(message);
        notify(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, debouncedSearch, page, reloadKey, notify]);

    useEffect(() => {
      const timer = window.setTimeout(() => {
        setDebouncedSearch(search.trim());
        setPage(1);
      }, 300);

      return () => window.clearTimeout(timer);
    }, [search]);

  useEffect(() => {
    if (!detail) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const modal = modalRef.current;
    const focusable = modal?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );

    focusable?.[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setDetail(null);
        return;
      }

      if (event.key !== "Tab" || !modal) return;

      const elements = modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;

      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [detail]);

  const reload = () => setReloadKey((key) => key + 1);

  const retry = () => {
    setLoading(true);
    setLoadError("");
    reload();
  };

  const changeFilter = (event) => {
    setLoading(true);
    setLoadError("");
    setPage(1);
    setActive(event.target.value);
  };

  const view = async (id) => {
    if (viewLoading) return;

    triggerRef.current = document.activeElement;
    setViewLoading(true);

    try {
      const response = await api.get(`/admin/customers/${id}`);
      setDetail(response.data);
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to load customer."), "error");
    } finally {
      setViewLoading(false);
    }
  };

  const toggle = async (customer) => {
    if (pendingId) return;
    const nextActive = !customer.is_active;
    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${customer.first_name}? They will lose account access.`,
      )
    ) {
      return;
    }

    setPendingId(customer.id);
    try {
      await api.patch(`/admin/customers/${customer.id}/status`, {
        is_active: nextActive,
      });
      notify(`Customer ${nextActive ? "activated" : "deactivated"}.`);
      setDetail((current) =>
        current?.id === customer.id
          ? { ...current, is_active: nextActive }
          : current,
      );
      reload();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to update customer status."),
        "error",
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Customer records and account access status."
      />
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        <div className="flex flex-col gap-3 border-b border-[#E3E5DF] p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2
                        -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                setLoading(value.trim() !== debouncedSearch);
              }}
              placeholder="Search by name, email or phone..."
              className="w-full rounded-xl border border-gray-300
                        bg-white py-3 pl-10 pr-10
                        outline-none focus:border-emerald-700
                        focus:ring-2 focus:ring-emerald-700/20"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2
                          -translate-y-1/2 text-gray-500
                          hover:text-gray-900"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <select
            className="field w-full sm:max-w-56"
            aria-label="Filter customer accounts"
            value={active}
            onChange={changeFilter}
          >
            <option value="">All customers</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading customers…
          </div>
        ) : loadError ? (
          <div className="px-5 py-8">
            <div role="alert" className="text-sm text-[#8b4033]">
              {loadError}
            </div>
            <button
              type="button"
              onClick={retry}
              className="button-secondary mt-3"
            >
              Retry
            </button>
          </div>
          ) : totalCount > 0 ? (
            <>
              <div className="space-y-3 p-3 xl:hidden">
                {rows.map((c) => (
                  <article
                    key={c.id}
                    className="min-w-0 rounded-xl border border-[#E3E5DF] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-semibold">
                          {c.first_name} {c.last_name || ""}
                        </h3>

                        <p className="mt-1 break-all text-xs text-[#737A74]">
                          {c.email}
                        </p>

                        <p className="mt-1 break-words text-xs text-[#737A74]">
                          {c.phone_number || "No phone number"}
                        </p>
                      </div>

                      <Badge>{c.is_active ? "active" : "inactive"}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E3E5DF] pt-3">
                      <p className="text-xs text-[#737A74]">
                        Joined {formatDate(c.created_at)}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={viewLoading}
                          onClick={() => view(c.id)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm font-medium hover:bg-[#F5F5F1] disabled:opacity-50"
                        >
                          <Eye size={15} />
                          View
                        </button>

                        <button
                          type="button"
                          disabled={pendingId === c.id}
                          onClick={() => toggle(c)}
                          className="min-h-10 rounded-lg px-2 text-sm font-medium text-[#486B57] disabled:opacity-50"
                        >
                          {pendingId === c.id
                            ? "Updating..."
                            : c.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Full table on wider screens */}
              <div className="hidden xl:block">
                <AdminTable
                  headers={[
                    "Customer",
                    "Email",
                    "Phone",
                    "Joined",
                    "Status",
                    "Actions",
                  ]}
                >
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="break-words px-5 py-4 font-medium">
                        {c.first_name} {c.last_name || ""}
                      </td>
                      <td className="break-all px-5 py-4">{c.email}</td>
                      <td className="px-5 py-4">{c.phone_number || "—"}</td>
                      <td className="px-5 py-4">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-4">
                        <Badge>{c.is_active ? "active" : "inactive"}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            aria-label={`View ${c.first_name}`}
                            disabled={viewLoading}
                            onClick={() => view(c.id)}
                            className="rounded-lg p-2 hover:bg-[#DCE7DE] disabled:opacity-50"
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={pendingId === c.id}
                            className="text-sm font-medium text-[#486B57] disabled:opacity-50"
                            onClick={() => toggle(c)}
                          >
                            {pendingId === c.id
                              ? "Updating..."
                              : c.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </AdminTable>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-[#E3E5DF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#737A74] sm:text-sm">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} customers
                </p>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setLoading(true);
                      setPage((current) => current - 1);
                    }}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <span className="whitespace-nowrap text-xs text-[#737A74]">
                    {page} / {pageCount}
                  </span>

                  <button
                    type="button"
                    disabled={page >= pageCount || loading}
                    onClick={() => {
                      setLoading(true);
                      setPage((current) => current + 1);
                    }}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <AdminEmpty>
              {debouncedSearch
                ? `No customers match "${debouncedSearch}".`
                : active
                  ? "No customers in this view."
                  : "No customers found."}
            </AdminEmpty>
          )}
      </AdminPanel>
      {detail && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-details-title"
        >
          <section className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex justify-between">
              <h2
                id="customer-details-title"
                className="text-xl font-semibold"
              >
                Customer
              </h2>
              <button
                type="button"
                className="cursor-pointer rounded-lg px-2 py-1 text-sm text-[#486B57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
            <p className="mt-5 font-medium">
              {detail.first_name} {detail.last_name || ""}
            </p>
            <p className="mt-1 text-sm text-[#737A74]">{detail.email}</p>
            <p className="mt-1 text-sm text-[#737A74]">
              {detail.phone_number || "—"}
            </p>
            <p className="mt-4 text-sm">
              Joined {formatDate(detail.created_at)}
            </p>
            <div className="mt-4">
              <Badge>{detail.is_active ? "active" : "inactive"}</Badge>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#737A74]">
              The customer detail API does not include order totals or address
              summaries.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

export default AdminCustomers;