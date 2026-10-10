import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
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

const LOW_STOCK_THRESHOLD = 5;

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

function isLowStock(quantity) {
  return quantity !== null && quantity !== undefined
    ? Number.isFinite(Number(quantity)) &&
        Number(quantity) <= LOW_STOCK_THRESHOLD
    : false;
}

function AdminInventory() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [edit, setEdit] = useState(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const { notice, notify, clear } = useAdminNotice();

  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.get("/admin/inventory/"), api.get("/products/")])
      .then(([inventoryResult, productsResult]) => {
        if (cancelled) return;

        if (inventoryResult.status === "fulfilled") {
          const data = inventoryResult.value.data;
          setRows(Array.isArray(data) ? data : []);
          setLoadError("");
        } else {
          const message = apiErrorMessage(
            inventoryResult.reason,
            "Unable to load inventory.",
          );
          setLoadError(message);
          notify(message, "error");
        }

        if (productsResult.status === "fulfilled") {
          const data = productsResult.value.data;
          setProducts(
            Array.isArray(data)
              ? Object.fromEntries(data.map((x) => [x.id, x]))
              : {},
          );
        } else if (inventoryResult.status === "fulfilled") {
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

  const closeModal = useCallback(() => setEdit(null), []);

  useEffect(() => {
    if (!edit) return undefined;

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
  }, [edit, busy, closeModal]);

  const productName = (productId) =>
    products[productId]?.name || `Product ${productId}`;

  const save = async (event) => {
    event.preventDefault();
    if (busy || !edit) return;

    const quantity = Number(value);
    const reserved = Number(edit.reserved_quantity || 0);
    if (value.trim() === "" || !Number.isInteger(quantity) || quantity < 0) {
      notify("Enter a whole number of 0 or more.", "error");
      return;
    }
    if (quantity < reserved) {
      notify(
        `Quantity cannot be lower than reserved stock (${reserved}).`,
        "error",
      );
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/admin/inventory/${edit.product_id}`, { quantity });
      notify("Inventory updated.");
      setEdit(null);
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to update inventory."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Track on-hand, reserved, and available product quantities."
      />
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading inventory…
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
              "Product",
              "SKU / ID",
              "On hand",
              "Reserved",
              "Available",
              "Actions",
            ]}
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-medium">
                  {productName(r.product_id)}
                </td>
                <td className="px-5 py-4 text-[#737A74]">
                  {products[r.product_id]?.sku || `#${r.product_id}`}
                </td>
                <td className="px-5 py-4">{r.quantity}</td>
                <td className="px-5 py-4">{r.reserved_quantity}</td>
                <td className="px-5 py-4">
                  {isLowStock(r.available_quantity) ? (
                    <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                      {r.available_quantity}
                    </span>
                  ) : (
                    <Badge>{r.available_quantity ?? "—"}</Badge>
                  )}
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    aria-label={`Edit inventory for ${productName(r.product_id)}`}
                    className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setEdit(r);
                      setValue(String(r.quantity ?? ""));
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No inventory records.</AdminEmpty>
        )}
      </AdminPanel>
      {edit && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
        >
          <form
            ef={modalRef}
            onSubmit={save}
            className="w-full max-w-md rounded-2xl bg-white p-6"
          >
            <h2 id="inventory-modal-title" className="text-xl font-semibold">
              Update stock
            </h2>
            <p className="mt-2 text-sm text-[#737A74]">
              {productName(edit.product_id)} · {edit.reserved_quantity} reserved
            </p>
            <label className="mt-5 block text-sm font-medium">
              On-hand quantity
              <input
                required
                min={edit.reserved_quantity || 0}
                step="1"
                type="number"
                className="field mt-2"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-[#737A74]">
              Quantity cannot be lower than reserved stock (
              {edit.reserved_quantity}).
            </p>
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
                {busy ? "Saving…" : "Save quantity"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AdminInventory;