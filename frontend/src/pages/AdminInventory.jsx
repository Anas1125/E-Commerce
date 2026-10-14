import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
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

const LOW_STOCK_THRESHOLD = 5;
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { notice, notify, clear } = useAdminNotice();

  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      api.get("/admin/inventory/"),
      api.get("/products/"),
    ])
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
              ? Object.fromEntries(
                  data.map((product) => [product.id, product]),
                )
              : {},
          );
        } else if (inventoryResult.status === "fulfilled") {
          notify(
            "Products could not be loaded, so product names may be missing.",
            "error",
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;

        const message = apiErrorMessage(
          error,
          "Unable to load inventory.",
        );

        setLoadError(message);
        notify(message, "error");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, notify]);

  const reload = () => {
    setLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  };

  const retry = () => {
    reload();
  };

  const closeModal = useCallback(() => {
    if (!busyRef.current) {
      setEdit(null);
    }
  }, []);

  useEffect(() => {
    if (!edit) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstFocusable = modalRef.current?.querySelector(
      'input, select, button, textarea, [href], [tabindex]:not([tabindex="-1"])',
    );

    firstFocusable?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) {
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

      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [edit, closeModal]);

  const productName = (productId) =>
    products[productId]?.name || `Product ${productId}`;

  // Search inventory by product name, SKU, or product ID.
  const filteredRows = rows.filter((row) => {
    const name = productName(row.product_id).toLowerCase();

    const sku = String(
      products[row.product_id]?.sku || "",
    ).toLowerCase();

    const productId = String(row.product_id ?? "").toLowerCase();

    const query = search.trim().toLowerCase();

    return `${name} ${sku} ${productId}`.includes(query);
  });

  // Pagination.
  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, pageCount);

  const visibleRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const openEdit = (row, trigger) => {
    triggerRef.current = trigger;
    setEdit(row);
    setValue(String(row.quantity ?? ""));
  };

  // Save updated stock quantity.
  const save = async (event) => {
    event.preventDefault();

    if (busyRef.current || !edit) return;

    const quantity = Number(value);
    const reserved = Number(edit.reserved_quantity || 0);

    if (
      value.trim() === "" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
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

    busyRef.current = true;
    setBusy(true);

    try {
      await api.patch(
        `/admin/inventory/${edit.product_id}`,
        { quantity },
      );

      notify("Inventory updated.");
      setEdit(null);
      reload();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to update inventory."),
        "error",
      );
    } finally {
      busyRef.current = false;
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
        {/* Search bar */}
        <div className="flex flex-col gap-3 border-b border-[#E3E5DF] p-4">
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search product, SKU or ID..."
              aria-label="Search inventory"
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-10 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            />

            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading inventory…
          </div>
        ) : loadError ? (
          /* Error state */
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
        ) : filteredRows.length ? (
          <>
            {/* Mobile inventory cards */}
            <div className="space-y-3 p-3 xl:hidden">
              {visibleRows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-[#E3E5DF] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold">
                        {productName(row.product_id)}
                      </h3>

                      <p className="mt-1 break-all text-xs text-[#737A74]">
                        SKU:{" "}
                        {products[row.product_id]?.sku ||
                          `#${row.product_id}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={`Edit inventory for ${productName(row.product_id)}`}
                      disabled={busy}
                      className="shrink-0 rounded-lg border border-[#E3E5DF] p-2 hover:bg-[#F5F5F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] disabled:opacity-50"
                      onClick={(event) =>
                        openEdit(row, event.currentTarget)
                      }
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#E3E5DF] pt-3">
                    <div>
                      <p className="text-xs text-[#737A74]">
                        On hand
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {row.quantity}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#737A74]">
                        Reserved
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {row.reserved_quantity}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#737A74]">
                        Available
                      </p>

                      {isLowStock(row.available_quantity) ? (
                        <p className="mt-1 text-sm font-semibold text-red-600">
                          {row.available_quantity}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-[#486B57]">
                          {row.available_quantity ?? "—"}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop inventory table */}
            <div className="hidden xl:block">
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
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4 font-medium">
                      {productName(row.product_id)}
                    </td>

                    <td className="px-5 py-4 text-[#737A74]">
                      {products[row.product_id]?.sku ||
                        `#${row.product_id}`}
                    </td>

                    <td className="px-5 py-4">
                      {row.quantity}
                    </td>

                    <td className="px-5 py-4">
                      {row.reserved_quantity}
                    </td>

                    <td className="px-5 py-4">
                      {isLowStock(row.available_quantity) ? (
                        <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                          {row.available_quantity}
                        </span>
                      ) : (
                        <Badge>
                          {row.available_quantity ?? "—"}
                        </Badge>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        aria-label={`Edit inventory for ${productName(row.product_id)}`}
                        disabled={busy}
                        className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] disabled:opacity-50"
                        onClick={(event) =>
                          openEdit(row, event.currentTarget)
                        }
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-[#E3E5DF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#737A74] sm:text-sm">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(
                  currentPage * PAGE_SIZE,
                  filteredRows.length,
                )}{" "}
                of {filteredRows.length} inventory records
              </p>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() =>
                    setPage((current) => current - 1)
                  }
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="whitespace-nowrap text-xs text-[#737A74]">
                  {currentPage} / {pageCount}
                </span>

                <button
                  type="button"
                  disabled={
                    currentPage >= pageCount || loading
                  }
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <AdminEmpty>
            {search.trim()
              ? `No inventory matches "${search.trim()}".`
              : "No inventory records."}
          </AdminEmpty>
        )}
      </AdminPanel>

      {/* Edit inventory modal */}
      {edit && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
        >
          <form
            ref={modalRef}
            onSubmit={save}
            className="w-full max-w-md rounded-2xl bg-white p-6"
          >
            <h2
              id="inventory-modal-title"
              className="text-xl font-semibold"
            >
              Update stock
            </h2>

            <p className="mt-2 text-sm text-[#737A74]">
              {productName(edit.product_id)} ·{" "}
              {edit.reserved_quantity} reserved
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
                disabled={busy}
                onChange={(event) =>
                  setValue(event.target.value)
                }
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
                className="button-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] disabled:opacity-50"
                onClick={closeModal}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={busy}
                className="button-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] disabled:opacity-50"
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