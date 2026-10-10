import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;
    api
      .get("/admin/customers/", {
        params: active ? { is_active: active } : {},
      })
      .then((response) => {
        if (cancelled) return;
        setRows(Array.isArray(response.data) ? response.data : []);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const message = apiErrorMessage(error, "Unable to load customers.");
        setLoadError(message);
        notify(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, reloadKey, notify]);

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
        <div className="border-b border-[#E3E5DF] p-4">
          <select
            className="field max-w-56"
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
        ) : rows.length ? (
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
                <td className="px-5 py-4 font-medium">
                  {c.first_name} {c.last_name || ""}
                </td>
                <td className="px-5 py-4">{c.email}</td>
                <td className="px-5 py-4">{c.phone_number || "—"}</td>
                <td className="px-5 py-4">{formatDate(c.created_at)}</td>
                <td className="px-5 py-4">
                  <Badge>{c.is_active ? "active" : "inactive"}</Badge>
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    aria-label={`View ${c.first_name}`}
                    disabled={viewLoading}
                    onClick={() => view(c.id)}
                    className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] disabled:opacity-50"
                  >
                    <Eye size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === c.id}
                    className="ml-1 cursor-pointer text-sm font-medium text-[#486B57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] disabled:opacity-50"
                    onClick={() => toggle(c)}
                  >
                    {c.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No customers in this view.</AdminEmpty>
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