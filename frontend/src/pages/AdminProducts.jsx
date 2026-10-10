import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";

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

const PRODUCTS_PER_PAGE = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const blank = {
  name: "",
  slug: "",
  description: "",
  brand: "",
  price: "",
  category_id: "",
  stock: "0",
  reserved_quantity: "0",
};

function apiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }

  if (
    detail &&
    typeof detail === "object" &&
    typeof detail.message === "string"
  ) {
    return detail.message;
  }

  return fallback;
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryByProductId, setInventoryByProductId] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const imagesRequestRef = useRef(0);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [selectedPrimary, setSelectedPrimary] = useState(false);
  const selectedFile = selected?.file ?? null;
  const imagePreview = selected?.url ?? "";

  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");

  const { notice, notify, clear } = useAdminNotice();

  // Revoke the blob URL whenever it is replaced or the component unmounts
  useEffect(() => {
    if (!imagePreview) return undefined;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  // Fetch lives inside the effect; state is only set in promise callbacks.
  // Inventory comes from one admin call instead of one request per product.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.get("/products/"),
      api.get("/categories/"),
      api.get("/admin/inventory/"),
    ])
      .then(([productsResult, categoriesResult, inventoryResult]) => {
        if (cancelled) return;

        if (productsResult.status === "fulfilled") {
          const data = productsResult.value.data;
          setProducts(Array.isArray(data) ? data : []);
          setLoadError("");
        } else {
          const message = apiErrorMessage(
            productsResult.reason,
            "Unable to load products.",
          );
          setLoadError(message);
          notify(message, "error");
        }

        const missing = [];

        if (categoriesResult.status === "fulfilled") {
          const data = categoriesResult.value.data;
          setCategories(Array.isArray(data) ? data : []);
        } else {
          missing.push("categories");
        }

        if (inventoryResult.status === "fulfilled") {
          const data = inventoryResult.value.data;
          setInventoryByProductId(
            Array.isArray(data)
              ? Object.fromEntries(data.map((row) => [row.product_id, row]))
              : {},
          );
        } else {
          missing.push("inventory");
        }

        if (productsResult.status === "fulfilled" && missing.length) {
          notify(
            `Could not load ${missing.join(" and ")}. Some details may be missing or approximate.`,
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

  const categoryNames = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const getInventory = (product) => {
    const inventory = inventoryByProductId[product.id];
    const stock = Number(inventory?.quantity ?? product.stock ?? 0);
    const reserved = Number(inventory?.reserved_quantity ?? 0);
    return { stock, reserved, available: Math.max(0, stock - reserved) };
  };

  const dismissModal = useCallback(() => {
    imagesRequestRef.current += 1; // ignore any in-flight image loads
    setOpen(false);
  }, []);

  const closeModal = () => {
    if (busy || imageBusy) return;
    dismissModal();
  };

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!busy && !imageBusy) {
          dismissModal();
        }
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      modalRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);

      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    };
  }, [open, busy, imageBusy, dismissModal]);

  const show = (product) => {
    const inventory = product ? inventoryByProductId[product.id] : null;

    setEditing(product?.id ?? null);
    setForm(
      product
        ? {
            name: product.name || "",
            slug: product.slug || "",
            description: product.description || "",
            brand: product.brand || "",
            price: String(product.price ?? ""),
            category_id:
              product.category_id != null ? String(product.category_id) : "",
            stock: String(inventory?.quantity ?? product.stock ?? 0),
            reserved_quantity: String(inventory?.reserved_quantity ?? 0),
          }
        : blank,
    );

    setImages([]);
    setSelected(null);
    setSelectedPrimary(false);
    setImageError("");
    setImageSuccess("");
    setOpen(true);

    const requestId = ++imagesRequestRef.current;

    if (product) {
      setImagesLoading(true);
      api
        .get(`/products/${product.id}/images`)
        .then((response) => {
          if (imagesRequestRef.current !== requestId) return;
          setImages(Array.isArray(response.data) ? response.data : []);
        })
        .catch((error) => {
          if (imagesRequestRef.current !== requestId) return;
          setImageError(
            apiErrorMessage(error, "Unable to load product images."),
          );
        })
        .finally(() => {
          if (imagesRequestRef.current === requestId) setImagesLoading(false);
        });
    } else {
      setImagesLoading(false);
    }
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    setImageError("");
    setImageSuccess("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelected(null);
      setImageError("Choose a JPG, JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setSelected(null);
      setImageError("Choose an image that is 10 MB or smaller.");
      return;
    }

    setSelected({ file, url: URL.createObjectURL(file) });
    setSelectedPrimary(!images.some((image) => image.is_primary));
  };

  // Returns true on success, false on failure (never throws)
  const uploadImage = async (
    productId,
    file = selectedFile,
    primary = selectedPrimary,
  ) => {
    if (!file) return true;

    setImageBusy(true);
    setImageError("");
    setImageSuccess("");

    const data = new FormData();
    data.append("file", file);
    data.append("is_primary", String(primary));
    data.append("display_order", String(images.length));

    try {
      // Don't set Content-Type manually; the browser/axios adds the boundary
      await api.post(`/products/${productId}/images/upload`, data);
    } catch (error) {
      setImageError(apiErrorMessage(error, "Unable to upload this image."));
      setImageBusy(false);
      return false;
    }

    setSelected(null);
    setImageSuccess("Image uploaded successfully.");
    notify("Product image uploaded.");

    try {
      const response = await api.get(`/products/${productId}/images`);
      setImages(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setImageError(
        apiErrorMessage(
          error,
          "Image uploaded, but the image list could not be refreshed.",
        ),
      );
    } finally {
      setImageBusy(false);
    }
    return true;
  };

  const setExistingPrimary = async (image) => {
    if (image.is_primary || imageBusy) return;

    setImageBusy(true);
    setImageError("");

    try {
      const response = await api.patch(
        `/products/${editing}/images/${image.id}`,
        { is_primary: true },
      );

      setImages((current) =>
        current.map((item) => ({
          ...item,
          is_primary: item.id === response.data.id,
        })),
      );

      notify("Primary image updated.");
    } catch (error) {
      setImageError(
        apiErrorMessage(error, "Unable to update the primary image."),
      );
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = async (image) => {
    if (imageBusy) return;
    if (!window.confirm("Remove this product image?")) return;

    setImageBusy(true);
    setImageError("");

    try {
      await api.delete(`/products/${editing}/images/${image.id}`);
      const response = await api.get(`/products/${editing}/images`);
      setImages(Array.isArray(response.data) ? response.data : []);
      notify("Product image removed.");
    } catch (error) {
      setImageError(apiErrorMessage(error, "Unable to remove this image."));
    } finally {
      setImageBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const slug = form.slug.trim();
    const price = Number(form.price);
    const stock = Number(form.stock);
    const reserved = Number(form.reserved_quantity);

    if (!name || !slug) {
      notify("Name and slug are required.", "error");
      return;
    }
    if (!form.category_id) {
      notify("Select a category.", "error");
      return;
    }
    if (!(price > 0)) {
      notify("Price must be greater than zero.", "error");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      notify("Stock must be a whole number of 0 or more.", "error");
      return;
    }
    if (!Number.isInteger(reserved) || reserved < 0) {
      notify("Reserved quantity must be a whole number of 0 or more.", "error");
      return;
    }
    if (reserved > stock) {
      notify("Reserved quantity cannot be higher than stock.", "error");
      return;
    }

    setBusy(true);
    setImageError("");

    const wasEditing = Boolean(editing);
    let stage = "product";

    try {
      const payload = {
        name,
        slug,
        description: form.description.trim() || null,
        brand: form.brand.trim() || null,
        price,
        category_id: Number(form.category_id),
        stock,
      };

      const response = wasEditing
        ? await api.put(`/products/${editing}`, payload)
        : await api.post("/products/", payload);

      const productId = response.data.id;
      // Remember the id right away so a retry updates instead of duplicating
      setEditing(productId);

      stage = "inventory";
      await api.put(`/products/${productId}/inventory`, {
        quantity: stock,
        reserved_quantity: reserved,
      });

      setPage(1);
      reload();

      stage = "image";
      if (selectedFile) {
        const uploaded = await uploadImage(
          productId,
          selectedFile,
          selectedPrimary,
        );
        if (!uploaded) {
          notify(
            "Product saved, but the image still needs to be uploaded.",
            "error",
          );
          return;
        }
      }

      dismissModal();
      notify(wasEditing ? "Product updated." : "Product created.");
    } catch (error) {
      const message = apiErrorMessage(error, "Product could not be saved.");
      if (stage === "inventory") {
        reload();
        notify(
          `Product saved, but inventory could not be updated: ${message}`,
          "error",
        );
      } else {
        notify(message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (product) => {
    if (pendingId) return;
    if (!window.confirm(`Deactivate “${product.name}”?`)) return;

    setPendingId(product.id);
    try {
      await api.delete(`/products/${product.id}`);
      notify("Product deactivated.");
      setPage(1);
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Could not deactivate product."), "error");
    } finally {
      setPendingId(null);
    }
  };

  // Search the COMPLETE product list first, then paginate.
  const needle = term.trim().toLowerCase();
  const filtered = products.filter((product) =>
    `${product.name} ${product.brand || ""} ${product.slug}`
      .toLowerCase()
      .includes(needle),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filtered.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE,
  );

  const formAvailable = Math.max(
    0,
    (Number(form.stock) || 0) - (Number(form.reserved_quantity) || 0),
  );

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Create and maintain the product catalogue."
      >
        <button
          type="button"
          ref={triggerRef}
          onClick={() => show(null)}
          className="button-primary inline-flex cursor-pointer gap-2"
        >
          <Plus size={16} aria-hidden="true" />
          Add product
        </button>
      </AdminPageHeader>

      <AdminNotice notice={notice} onClose={clear} />

      <AdminPanel>
        <div className="flex items-center justify-between gap-4 border-b border-[#E3E5DF] p-4">
          <label className="flex max-w-sm flex-1 items-center gap-2 rounded-xl border border-[#E3E5DF] px-3">
            <Search
              size={16}
              className="text-[#737A74]"
              aria-hidden="true"
            />
            <input
              aria-label="Search products"
              className="w-full bg-transparent py-2 text-sm outline-none"
              placeholder="Search name, brand or slug"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <span className="text-xs text-[#737A74]">
            {filtered.length} products
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading products…
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
        ) : filtered.length ? (
          <>
            <AdminTable
              headers={[
                "Product",
                "Brand",
                "Category",
                "Price",
                "Inventory",
                "Actions",
              ]}
            >
              {paginatedProducts.map((product) => {
                const { stock, reserved, available } = getInventory(product);
                return (
                  <tr key={product.id}>
                    <td className="px-5 py-4">
                      <span className="font-medium">{product.name}</span>
                      <span className="mt-1 block text-xs text-[#737A74]">
                        {product.slug}
                      </span>
                    </td>

                    <td className="px-5 py-4">{product.brand || "—"}</td>

                    <td className="px-5 py-4">
                      {categoryNames.get(product.category_id) || "—"}
                    </td>

                    <td className="px-5 py-4">
                      ₹{Number(product.price).toLocaleString("en-IN")}
                    </td>

                    <td className="px-5 py-4">
                      <div className="w-32 space-y-1.5 text-xs">
                        <div className="grid grid-cols-[1fr_40px] items-center gap-2">
                          <span className="text-[#737A74]">Stock</span>
                          <span className="flex h-8 w-10 items-center justify-center rounded-full bg-[#DCE7DE] font-semibold text-[#486B57]">
                            {stock}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_40px] items-center gap-2">
                          <span className="text-[#737A74]">Reserved</span>
                          <span className="text-center font-medium text-[#8b4033]">
                            {reserved}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_40px] items-center gap-2">
                          <span className="text-[#737A74]">Available</span>
                          <span className="text-center font-semibold text-[#486B57]">
                            {available}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label={`Edit ${product.name}`}
                          className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                          onClick={(event) => {
                            triggerRef.current = event.currentTarget;
                            show(product);
                          }}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`Deactivate ${product.name}`}
                          disabled={pendingId === product.id}
                          className="cursor-pointer rounded-lg p-2 text-[#8b4033] hover:bg-[#f8e8e3] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4033]"
                          onClick={() => removeProduct(product)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </AdminTable>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-[#E3E5DF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#737A74]">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(startIndex + PRODUCTS_PER_PAGE, filtered.length)} of{" "}
                  {filtered.length} products
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    className="cursor-pointer rounded-lg border border-[#E3E5DF] px-3 py-2 text-sm font-medium text-[#486B57] transition hover:bg-[#F0F4EF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-sm text-[#737A74]">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setPage(Math.min(totalPages, currentPage + 1))
                    }
                    className="cursor-pointer rounded-lg border border-[#E3E5DF] px-3 py-2 text-sm font-medium text-[#486B57] transition hover:bg-[#F0F4EF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <AdminEmpty>
            {needle ? "No products match this search." : "No products yet."}
          </AdminEmpty>
        )}
      </AdminPanel>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
        >
          <form
            ref={modalRef}
            tabIndex={-1}
            onSubmit={save}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          >
            <div className="flex justify-between">
              <h2
                id="product-modal-title"
                className="text-xl font-semibold"
              >
                {editing ? "Edit product" : "Add product"}
              </h2>

              <button
                type="button"
                disabled={busy || imageBusy}
                className="cursor-pointer text-sm text-[#486B57] disabled:opacity-50"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AdminField label="Product name">
                <input
                  required
                  maxLength={200}
                  className="field mt-2"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Slug">
                <input
                  required
                  maxLength={200}
                  className="field mt-2"
                  value={form.slug}
                  onChange={(event) =>
                    setForm({ ...form, slug: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Brand">
                <input
                  className="field mt-2"
                  value={form.brand}
                  onChange={(event) =>
                    setForm({ ...form, brand: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Category">
                <select
                  required
                  className="field mt-2"
                  value={form.category_id}
                  onChange={(event) =>
                    setForm({ ...form, category_id: event.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </AdminField>

              <AdminField label="Price (₹)">
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  className="field mt-2"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Stock quantity">
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  className="field mt-2"
                  value={form.stock}
                  onChange={(event) =>
                    setForm({ ...form, stock: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Reserved quantity">
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  className="field mt-2"
                  value={form.reserved_quantity}
                  onChange={(event) =>
                    setForm({ ...form, reserved_quantity: event.target.value })
                  }
                />
              </AdminField>

              <div className="flex items-center justify-between rounded-xl border border-[#E3E5DF] bg-[#F7F9F6] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#212121]">
                    Available quantity
                  </p>
                  <p className="mt-1 text-xs text-[#737A74]">
                    Stock minus reserved quantity
                  </p>
                </div>

                <span
                  className={`text-xl font-bold ${
                    formAvailable > 0 ? "text-[#486B57]" : "text-[#8b4033]"
                  }`}
                >
                  {formAvailable}
                </span>
              </div>

              <div className="sm:col-span-2">
                <AdminField label="Description">
                  <textarea
                    className="field mt-2 min-h-24"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </AdminField>
              </div>
            </div>

            <section className="mt-7 border-t border-[#E3E5DF] pt-5">
              <div>
                <h3 className="font-semibold">Product images</h3>
                <p className="mt-1 text-xs leading-5 text-[#737A74]">
                  Choose JPG, JPEG, PNG, or WebP images up to 10 MB.
                </p>
              </div>

              {imagesLoading ? (
                <p role="status" className="mt-4 text-sm text-[#737A74]">
                  Loading existing images…
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="flex gap-3 rounded-xl border border-[#E3E5DF] p-3"
                    >
                      <img
                        src={image.image_url}
                        alt={form.name ? `${form.name} image` : "Product image"}
                        className="h-20 w-20 shrink-0 rounded-lg bg-[#F0F1EC] object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs text-[#737A74]"
                          title={image.image_url}
                        >
                          {image.image_url}
                        </p>

                        {image.is_primary ? (
                          <Badge>Primary image</Badge>
                        ) : (
                          <button
                            type="button"
                            disabled={imageBusy}
                            className="mt-2 cursor-pointer text-xs font-medium text-[#486B57] disabled:opacity-50"
                            onClick={() => setExistingPrimary(image)}
                          >
                            Set as primary
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={imageBusy}
                          className="ml-3 mt-2 cursor-pointer text-xs text-[#8b4033] disabled:opacity-50"
                          onClick={() => removeImage(image)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-dashed border-[#B8C7BA] p-4">
                <label className="button-secondary inline-flex cursor-pointer items-center gap-2">
                  <ImagePlus size={16} aria-hidden="true" />
                  Choose image
                  <input
                    className="sr-only"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={selectImage}
                  />
                </label>

                {selectedFile && (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <img
                      src={imagePreview}
                      alt="Selected image preview"
                      className="h-24 w-24 rounded-lg bg-[#F0F1EC] object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {selectedFile.name}
                      </p>

                      <p className="mt-1 text-xs text-[#737A74]">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>

                      <label className="mt-2 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedPrimary}
                          onChange={(event) =>
                            setSelectedPrimary(event.target.checked)
                          }
                        />
                        Set as primary image
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={busy || imageBusy || !editing}
                      className="button-primary inline-flex cursor-pointer items-center gap-2"
                      title={
                        !editing
                          ? "Save the product first to upload its image"
                          : undefined
                      }
                      onClick={() => uploadImage(editing)}
                    >
                      <Upload size={15} aria-hidden="true" />
                      {imageBusy ? "Uploading…" : "Upload image"}
                    </button>
                  </div>
                )}

                {!editing && (
                  <p className="mt-3 text-xs text-[#737A74]">
                    Save the product first; the selected image will then upload
                    automatically.
                  </p>
                )}
              </div>

              {imageError && (
                <p role="alert" className="mt-3 text-sm text-[#8b4033]">
                  {imageError}
                </p>
              )}

              {imageSuccess && (
                <p role="status" className="mt-3 text-sm text-[#486B57]">
                  {imageSuccess}
                </p>
              )}
            </section>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy || imageBusy}
                className="button-secondary cursor-pointer"
                onClick={closeModal}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={busy}
                className="button-primary cursor-pointer"
              >
                {busy ? "Saving…" : "Save product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AdminProducts;