import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Edit3, Plus, Power, Trash2, X } from "lucide-react";

import api from "../services/api";
import useAdminNotice from "../hooks/useAdminNotice";

import {
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const localDate = (offset = 0) =>
  toLocalInput(new Date(Date.now() + offset * 86400000));

// Function (not a constant) so default dates are fresh every time
const getInitialForm = () => ({
  code: "",
  name: "",
  discount_type: "percentage",
  value: "",
  minimum_order_amount: "0",
  maximum_discount: "",
  usage_limit: "",
  per_user_limit: "1",
  first_order_only: false,
  start_date: localDate(0),
  end_date: localDate(7),
  is_active: true,
});

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

function AdminCoupons() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getInitialForm);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const { notice, notify, clear } = useAdminNotice();

  // Fetch lives inside the effect; state is only set in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api
      .get("/coupons/")
      .then((response) => {
        if (cancelled) return;
        setRows(Array.isArray(response.data) ? response.data : []);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const message = apiErrorMessage(error, "Unable to load coupons.");
        setLoadError(message);
        notify(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, notify]);

  const reload = () => setReloadKey((key) => key + 1);

  const retry = () => {
    setLoading(true);
    setLoadError("");
    reload();
  };

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Unconditional reset: used after a successful save
  const resetModal = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setForm(getInitialForm());
  }, []);

  // Guarded close: used for user actions (cancel, X, Escape)
  const closeModal = () => {
    if (busy) return;
    resetModal();
  };

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const modal = modalRef.current;
    const focusable = modal?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );

    focusable?.[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        resetModal();
        return;
      }

      if (event.key !== "Tab" || !modal) return;

      const elements = modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
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
  }, [open, busy, resetModal]);

  const openCreate = () => {
    triggerRef.current = document.activeElement;
    setEditing(null);
    setForm(getInitialForm());
    setOpen(true);
  };

  const openEdit = (coupon) => {
    triggerRef.current = document.activeElement;

    setEditing(coupon);
    setForm({
      code: coupon.code || "",
      name: coupon.name || "",
      discount_type: coupon.discount_type || "percentage",
      value: coupon.value ?? "",
      minimum_order_amount: coupon.minimum_order_amount ?? "0",
      maximum_discount: coupon.maximum_discount ?? "",
      usage_limit: coupon.usage_limit ?? "",
      per_user_limit: coupon.per_user_limit ?? "1",
      first_order_only: Boolean(coupon.first_order_only),
      start_date: toLocalInput(coupon.start_date),
      end_date: toLocalInput(coupon.end_date),
      is_active: coupon.is_active !== false,
    });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;

    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      notify("Enter valid start and end dates.", "error");
      return;
    }
    if (end <= start) {
      notify("End date must be after the start date.", "error");
      return;
    }
    const value = Number(form.value);
    if (!(value > 0)) {
      notify("Discount must be greater than zero.", "error");
      return;
    }
    if (form.discount_type === "percentage" && value > 100) {
      notify("Percentage discount cannot exceed 100.", "error");
      return;
    }

    const minimumOrder = Number(form.minimum_order_amount || 0);

    const maximumDiscount =
      form.discount_type === "percentage" && form.maximum_discount !== ""
        ? Number(form.maximum_discount)
        : null;

    const usageLimit =
      form.usage_limit !== "" ? Number(form.usage_limit) : null;

    const perUserLimit = Number(form.per_user_limit || 1);

    if (minimumOrder < 0) {
      notify("Minimum order amount cannot be negative.", "error");
      return;
    }

    if (maximumDiscount !== null && maximumDiscount <= 0) {
      notify("Maximum discount must be greater than zero.", "error");
      return;
    }

    if (usageLimit !== null && usageLimit < 1) {
      notify("Usage limit must be at least 1.", "error");
      return;
    }

    if (perUserLimit < 1) {
      notify("Per-user limit must be at least 1.", "error");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        discount_type: form.discount_type,
        value,
        minimum_order_amount: Number(form.minimum_order_amount || 0),
        maximum_discount:
          form.discount_type === "percentage" && form.maximum_discount !== ""
            ? Number(form.maximum_discount)
            : null,
        usage_limit: form.usage_limit !== "" ? Number(form.usage_limit) : null,
        per_user_limit: Number(form.per_user_limit || 1),
        first_order_only: Boolean(form.first_order_only),
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        is_active: Boolean(form.is_active),
      };

      if (editing) {
        await api.put(`/coupons/${editing.id}`, payload);
        notify("Coupon updated.");
      } else {
        await api.post("/coupons/", payload);
        notify("Coupon created.");
      }

      resetModal();
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to save coupon."), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (coupon) => {
    if (pendingId) return;
    setPendingId(coupon.id);
    try {
      await api.patch(`/coupons/${coupon.id}/status`, null, {
        params: { is_active: !coupon.is_active },
      });
      notify(coupon.is_active ? "Coupon deactivated." : "Coupon activated.");
      reload();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to update coupon status."),
        "error",
      );
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (coupon) => {
    if (pendingId) return;
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;
    setPendingId(coupon.id);
    try {
      await api.delete(`/coupons/${coupon.id}`);
      notify("Coupon deleted.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to delete coupon."), "error");
    } finally {
      setPendingId(null);
    }
  };

  const isPercentage = form.discount_type === "percentage";

  return (
    <>
      <AdminPageHeader
        title="Coupons"
        description="Manage customer coupon codes, eligibility and usage rules."
      >
        <button
          type="button"
          className="button-primary inline-flex cursor-pointer items-center gap-2"
          onClick={openCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Create coupon
        </button>
      </AdminPageHeader>

      <AdminNotice notice={notice} onClose={clear} />

      <AdminPanel>
        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading coupons…
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
              "Coupon",
              "Discount",
              "Minimum order",
              "Usage",
              "Eligibility",
              "Validity",
              "State",
              "Actions",
            ]}
          >
            {rows.map((coupon) => (
              <tr key={coupon.id}>
                <td className="px-5 py-4">
                  <div className="font-semibold">{coupon.code}</div>
                  <div className="mt-1 text-xs text-[#737A74]">
                    {coupon.name}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className="font-medium">
                    {coupon.discount_type === "percentage"
                      ? `${coupon.value}%`
                      : `₹${Number(coupon.value).toLocaleString("en-IN")}`}
                  </span>
                  {coupon.discount_type === "percentage" &&
                    coupon.maximum_discount != null &&
                    Number(coupon.maximum_discount) > 0 && (
                      <div className="mt-1 text-xs text-[#737A74]">
                        Max ₹
                        {Number(coupon.maximum_discount).toLocaleString(
                          "en-IN",
                        )}
                      </div>
                    )}
                </td>

                <td className="px-5 py-4">
                  ₹
                  {Number(coupon.minimum_order_amount || 0).toLocaleString(
                    "en-IN",
                  )}
                </td>

                <td className="px-5 py-4">
                  {coupon.used_count ?? 0}
                  {" / "}
                  {coupon.usage_limit ?? "∞"}
                </td>

                <td className="px-5 py-4">
                  <div className="space-y-1 text-xs">
                    {coupon.first_order_only && <Badge>First order</Badge>}
                    <div>{coupon.per_user_limit} per user</div>
                  </div>
                </td>

                <td className="px-5 py-4 text-xs">
                  <div>{formatDate(coupon.start_date)}</div>
                  <div className="mt-1 text-[#737A74]">
                    to {formatDate(coupon.end_date)}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <Badge>{coupon.is_active ? "active" : "inactive"}</Badge>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit coupon"
                      aria-label={`Edit ${coupon.code}`}
                      onClick={() => openEdit(coupon)}
                      className="cursor-pointer rounded-lg p-2 text-[#486B57] hover:bg-[#F5F5F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                    >
                      <Edit3 size={16} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      title={
                        coupon.is_active
                          ? "Deactivate coupon"
                          : "Activate coupon"
                      }
                      aria-label={
                        coupon.is_active
                          ? `Deactivate ${coupon.code}`
                          : `Activate ${coupon.code}`
                      }
                      disabled={pendingId === coupon.id}
                      onClick={() => toggleStatus(coupon)}
                      className="cursor-pointer rounded-lg p-2 text-[#486B57] hover:bg-[#F5F5F1] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      <Power size={16} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      title="Delete coupon"
                      aria-label={`Delete ${coupon.code}`}
                      disabled={pendingId === coupon.id}
                      onClick={() => remove(coupon)}
                      className="cursor-pointer rounded-lg p-2 text-[#486B57] hover:bg-[#F5F5F1] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No coupons configured.</AdminEmpty>
        )}
      </AdminPanel>

      {open && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Edit coupon" : "Create coupon"}
        >
          <form
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {editing ? "Edit coupon" : "Create coupon"}
                </h2>
                <p className="mt-1 text-sm text-[#737A74]">
                  Configure discount and eligibility rules.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="cursor-pointer rounded-lg p-2 hover:bg-[#F5F5F1]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminField label="Coupon code">
                <input
                  required
                  minLength={3}
                  maxLength={50}
                  className="field mt-2 uppercase"
                  value={form.code}
                  onChange={(e) => updateForm("code", e.target.value)}
                  placeholder="WELCOME10"
                />
              </AdminField>

              <AdminField label="Coupon name">
                <input
                  required
                  maxLength={150}
                  className="field mt-2"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Welcome Discount"
                />
              </AdminField>

              <AdminField label="Discount type">
                <select
                  className="field mt-2"
                  value={form.discount_type}
                  onChange={(e) => updateForm("discount_type", e.target.value)}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </AdminField>

              <AdminField
                label={
                  isPercentage ? "Discount percentage" : "Discount amount (₹)"
                }
              >
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={isPercentage ? 100 : undefined}
                  className="field mt-2"
                  value={form.value}
                  onChange={(e) => updateForm("value", e.target.value)}
                />
              </AdminField>

              <AdminField label="Minimum order amount (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="field mt-2"
                  value={form.minimum_order_amount}
                  onChange={(e) =>
                    updateForm("minimum_order_amount", e.target.value)
                  }
                />
              </AdminField>

              <AdminField label="Maximum discount (₹)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  disabled={!isPercentage}
                  className="field mt-2 disabled:cursor-not-allowed disabled:bg-[#F5F5F1]"
                  value={form.maximum_discount}
                  onChange={(e) =>
                    updateForm("maximum_discount", e.target.value)
                  }
                  placeholder={isPercentage ? "Optional" : "Percentage only"}
                />
              </AdminField>

              <AdminField label="Usage limit">
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="field mt-2"
                  value={form.usage_limit}
                  onChange={(e) => updateForm("usage_limit", e.target.value)}
                  placeholder="Unlimited"
                />
              </AdminField>

              <AdminField label="Per-user limit">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  className="field mt-2"
                  value={form.per_user_limit}
                  onChange={(e) => updateForm("per_user_limit", e.target.value)}
                />
              </AdminField>

              <AdminField label="Starts">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.start_date}
                  onChange={(e) => updateForm("start_date", e.target.value)}
                />
              </AdminField>

              <AdminField label="Ends">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(e) => updateForm("end_date", e.target.value)}
                />
              </AdminField>

              <label className="flex items-center gap-3 rounded-xl border border-[#E3E5DF] p-4 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.first_order_only}
                  onChange={(e) =>
                    updateForm("first_order_only", e.target.checked)
                  }
                />
                <span>
                  <span className="block font-medium">First order only</span>
                  <span className="mt-1 block text-xs text-[#737A74]">
                    Only customers who have never placed an order can use this
                    coupon.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-[#E3E5DF] p-4 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm("is_active", e.target.checked)}
                />
                <span>
                  <span className="block font-medium">Active</span>
                  <span className="mt-1 block text-xs text-[#737A74]">
                    Customers can use the coupon only when it is active and
                    within its validity dates.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="button-secondary cursor-pointer"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={busy}
                className="button-primary inline-flex cursor-pointer items-center gap-2"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                {busy ? "Saving…" : editing ? "Save changes" : "Create coupon"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AdminCoupons;