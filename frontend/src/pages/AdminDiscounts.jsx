import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import useAdminNotice from "../hooks/useAdminNotice";
import api from "../services/api";
import {
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

function toLocalInput(date) {
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

const localDate = (offset = 0) =>
  toLocalInput(new Date(Date.now() + offset * 86400000));

// Function (not a constant) so default dates are fresh every time
const getInitialForm = () => ({
  name: "",
  discount_type: "percentage",
  value: "",
  product_id: "",
  start_date: localDate(0),
  end_date: localDate(7),
  is_active: true,
});

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN");
}

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

function AdminDiscounts() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(getInitialForm);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const { notice, notify, clear } = useAdminNotice();

  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const productNames = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.get("/discounts/"), api.get("/products/")])
      .then(([discountsResult, productsResult]) => {
        if (cancelled) return;

        if (discountsResult.status === "fulfilled") {
          const data = discountsResult.value.data;
          setRows(Array.isArray(data) ? data : []);
          setLoadError("");
        } else {
          const message = apiErrorMessage(
            discountsResult.reason,
            "Unable to load discounts.",
          );
          setLoadError(message);
          notify(message, "error");
        }

        if (productsResult.status === "fulfilled") {
          const data = productsResult.value.data;
          setProducts(Array.isArray(data) ? data : []);
        } else if (discountsResult.status === "fulfilled") {
          notify(
            "Products could not be loaded, so product names may be missing.",
            "error",
          );
        }
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

  const closeModal = useCallback(() => {
    setOpen(false);
    setForm(getInitialForm());
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstFocusable = modalRef.current?.querySelector(
      'input, select, button, textarea, [href], [tabindex]:not([tabindex="-1"])',
    );

    firstFocusable?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        closeModal();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        modalRef.current?.querySelectorAll(
          'input, select, button, textarea, [href], [tabindex]:not([tabindex="-1"])',
        ) || [],
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, busy, closeModal]);

  const openCreate = () => {
    setForm(getInitialForm());
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const value = Number(form.value);
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);

    if (!name) {
      notify("Offer name is required.", "error");
      return;
    }
    if (!(value > 0)) {
      notify("Discount value must be greater than zero.", "error");
      return;
    }
    if (form.discount_type === "percentage" && value > 100) {
      notify("Percentage discount cannot exceed 100.", "error");
      return;
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      notify("Enter valid start and end dates.", "error");
      return;
    }
    if (end <= start) {
      notify("End date must be after the start date.", "error");
      return;
    }

    setBusy(true);
    try {
      await api.post("/discounts/", {
        name,
        discount_type: form.discount_type,
        value,
        product_id: form.product_id ? Number(form.product_id) : null,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        is_active: form.is_active,
      });
      closeModal();
      notify("Discount created.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to create discount."), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleDiscount = async (discount) => {
    if (pendingId) return;
    setPendingId(discount.id);
    try {
      await api.patch(`/discounts/${discount.id}/status`, null, {
        params: { is_active: !discount.is_active },
      });
      notify(discount.is_active ? "Discount disabled." : "Discount enabled.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to update discount."), "error");
    } finally {
      setPendingId(null);
    }
  };

  const deleteDiscount = async (discount) => {
    if (pendingId) return;
    if (!window.confirm(`Are you sure you want to delete "${discount.name}"?`))
      return;
    setPendingId(discount.id);
    try {
      await api.delete(`/discounts/${discount.id}`);
      notify("Discount deleted.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to delete discount."), "error");
    } finally {
      setPendingId(null);
    }
  };

  const isPercentage = form.discount_type === "percentage";

  return (
    <>
      <AdminPageHeader
        title="Discounts"
        description="Manage active product or storewide offers."
      >
        <button
          ref={triggerRef}
          type="button"
          className="button-primary inline-flex cursor-pointer gap-2"
          onClick={openCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Create discount
        </button>
      </AdminPageHeader>
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading discounts…
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
              "Offer",
              "Type",
              "Value",
              "Applies to",
              "Start",
              "End",
              "State",
              "Action",
            ]}
          >
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-4 font-medium">{d.name}</td>
                <td className="px-5 py-4 capitalize">{d.discount_type}</td>
                <td className="px-5 py-4">
                  {d.discount_type === "percentage"
                    ? `${d.value}%`
                    : `₹${Number(d.value).toLocaleString("en-IN")}`}
                </td>
                <td className="px-5 py-4">
                  {d.product_id
                    ? productNames.get(d.product_id) ||
                      `Product ${d.product_id}`
                    : "All products"}
                </td>
                <td className="px-5 py-4">{formatDate(d.start_date)}</td>
                <td className="px-5 py-4">{formatDate(d.end_date)}</td>
                <td className="px-5 py-4">
                  <Badge>{d.is_active ? "active" : "inactive"}</Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      disabled={pendingId === d.id}
                      onClick={() => toggleDiscount(d)}
                      className="cursor-pointer rounded text-sm font-semibold text-[#486B57] hover:text-[#2F513F] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"

                    >
                      {d.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === d.id}
                      onClick={() => deleteDiscount(d)}
                      className="cursor-pointer rounded text-sm font-semibold text-[#9A5547] hover:text-[#7F4035] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A5547]"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No discounts configured.</AdminEmpty>
        )}
      </AdminPanel>
      <p className="mt-4 text-xs text-[#737A74]">
        Discounts can be enabled or disabled at any time. Start and end dates
        still control when an active discount is valid.
      </p>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discount-modal-title"       
        >
          <form
            ref={modalRef}
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          >
            <div className="flex justify-between">
              <h2 id="discount-modal-title" className="text-xl font-semibold">
                Create discount
              </h2>
                <button
                type="button"
                disabled={busy}
                onClick={closeModal}
                className="cursor-pointer rounded text-sm text-[#486B57] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AdminField label="Offer name">
                <input
                  required
                  maxLength={150}
                  className="field mt-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </AdminField>
              <AdminField label="Discount type">
                <select
                  className="field mt-2"
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm({ ...form, discount_type: e.target.value })
                  }
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </AdminField>
              <AdminField
                label={isPercentage ? "Percentage (max 100)" : "Amount (₹)"}
              >
                <input
                  required
                  min="0.01"
                  max={isPercentage ? 100 : undefined}
                  step="0.01"
                  type="number"
                  className="field mt-2"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </AdminField>
              <AdminField label="Product (optional)">
                <select
                  className="field mt-2"
                  value={form.product_id}
                  onChange={(e) =>
                    setForm({ ...form, product_id: e.target.value })
                  }
                >
                  <option value="">All products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Starts">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                />
              </AdminField>
              <AdminField label="Ends">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                />
              </AdminField>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                className="button-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="button-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
              >
                {busy ? "Creating…" : "Create discount"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AdminDiscounts;