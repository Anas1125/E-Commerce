import { useCallback, useEffect, useMemo, useState } from "react";
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

const blank = {
  name: "",
  slug: "",
  description: "",
  brand: "",
  price: "",
  category_id: "",
  stock: "0",
};

function apiErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
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
  )
    return detail.message;
  return fallback;
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPrimary, setSelectedPrimary] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");
  const { notice, notify, clear } = useAdminNotice();
  const imagePreview = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );

  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const load = useCallback(async () => {
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        api.get("/products/"),
        api.get("/categories/"),
      ]);
      setProducts(productResponse.data);
      setCategories(categoryResponse.data);
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to load products."), "error");
    }
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const show = (product) => {
    setEditing(product?.id || null);
    setForm(
      product
        ? {
            name: product.name,
            slug: product.slug,
            description: product.description || "",
            brand: product.brand || "",
            price: product.price,
            category_id: String(product.category_id),
            stock: product.stock,
          }
        : blank,
    );
    setImages([]);
    setSelectedFile(null);
    setSelectedPrimary(false);
    setImageError("");
    setImageSuccess("");
    setOpen(true);
    if (product) {
      setImagesLoading(true);
      api
        .get(`/products/${product.id}/images`)
        .then((response) => setImages(response.data))
        .catch((error) =>
          setImageError(
            apiErrorMessage(error, "Unable to load product images."),
          ),
        )
        .finally(() => setImagesLoading(false));
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
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setSelectedFile(null);
      setImageError("Choose a JPG, JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setImageError("Choose an image that is 10 MB or smaller.");
      return;
    }
    setSelectedFile(file);
    setSelectedPrimary(!images.some((image) => image.is_primary));
  };

  const uploadImage = async (
    productId,
    file = selectedFile,
    primary = selectedPrimary,
  ) => {
    if (!file) return;
    setImageBusy(true);
    setImageError("");
    setImageSuccess("");
    const data = new FormData();
    data.append("file", file);
    data.append("is_primary", String(primary));
    data.append("display_order", String(images.length));
    try {
      await api.post(`/products/${productId}/images/upload`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const response = await api.get(`/products/${productId}/images`);
      setImages(response.data);
      setSelectedFile(null);
      setImageSuccess("Image uploaded successfully.");
      notify("Product image uploaded.");
    } catch (error) {
      const message = apiErrorMessage(error, "Unable to upload this image.");
      setImageError(message);
      throw error;
    } finally {
      setImageBusy(false);
    }
  };

  const setExistingPrimary = async (image) => {
    if (image.is_primary) return;
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
    if (!window.confirm("Remove this product image?")) return;
    setImageBusy(true);
    setImageError("");
    try {
      await api.delete(`/products/${editing}/images/${image.id}`);
      const response = await api.get(`/products/${editing}/images`);
      setImages(response.data);
      notify("Product image removed.");
    } catch (error) {
      setImageError(apiErrorMessage(error, "Unable to remove this image."));
    } finally {
      setImageBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setImageError("");
    const payload = {
      ...form,
      description: form.description || null,
      brand: form.brand || null,
      price: Number(form.price),
      category_id: Number(form.category_id),
      stock: Number(form.stock),
    };
    try {
      const response = editing
        ? await api.put(`/products/${editing}`, payload)
        : await api.post("/products/", payload);
      const productId = response.data.id;
      setEditing(productId);
      await load();
      if (selectedFile) {
        try {
          await uploadImage(productId, selectedFile, selectedPrimary);
        } catch {
          notify(
            "Product saved, but the image still needs to be uploaded.",
            "error",
          );
          return;
        }
      }
      setOpen(false);
      notify(editing ? "Product updated." : "Product created.");
    } catch (error) {
      notify(apiErrorMessage(error, "Product could not be saved."), "error");
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Deactivate “${product.name}”?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      notify("Product deactivated.");
      await load();
    } catch (error) {
      notify(apiErrorMessage(error, "Could not deactivate product."), "error");
    }
  };

  const filtered = products.filter((product) =>
    `${product.name} ${product.brand || ""} ${product.slug}`
      .toLowerCase()
      .includes(term.toLowerCase()),
  );

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Create and maintain the product catalogue."
      >
        <button
          onClick={() => show(null)}
          className="button-primary inline-flex gap-2 cursor-pointer"
        >
          <Plus size={16} />
          Add product
        </button>
      </AdminPageHeader>
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        <div className="flex items-center justify-between gap-4 border-b border-[#E3E5DF] p-4">
          <label className="flex max-w-sm flex-1 items-center gap-2 rounded-xl border border-[#E3E5DF] px-3">
            <Search size={16} className="text-[#737A74]" />
            <input
              aria-label="Search products"
              className="w-full bg-transparent py-2 text-sm outline-none"
              placeholder="Search name or brand"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
          <span className="text-xs text-[#737A74]">
            {filtered.length} products
          </span>
        </div>
        {filtered.length ? (
          <AdminTable
            headers={[
              "Product",
              "Brand",
              "Category",
              "Price",
              "Stock",
              "Actions",
            ]}
          >
            {filtered.map((product) => (
              <tr key={product.id}>
                <td className="px-5 py-4">
                  <span className="font-medium">{product.name}</span>
                  <span className="mt-1 block text-xs text-[#737A74]">
                    {product.slug}
                  </span>
                </td>
                <td className="px-5 py-4">{product.brand || "—"}</td>
                <td className="px-5 py-4">
                  {categories.find(
                    (category) => category.id === product.category_id,
                  )?.name || "—"}
                </td>
                <td className="px-5 py-4">
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  <Badge>{product.stock}</Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button
                      aria-label={`Edit ${product.name}`}
                      className="rounded-lg p-2 hover:bg-[#DCE7DE]"
                      onClick={() => show(product)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Deactivate ${product.name}`}
                      className="rounded-lg p-2 text-[#8b4033] hover:bg-[#f8e8e3]"
                      onClick={() => removeProduct(product)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No products match this search.</AdminEmpty>
        )}
      </AdminPanel>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={save}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">
                {editing ? "Edit product" : "Add product"}
              </h2>
              <button
                type="button"
                className="text-sm text-[#486B57]"
                onClick={() => setOpen(false)}
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
                        alt="Product"
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
                            className="mt-2 text-xs font-medium text-[#486B57]"
                            onClick={() => setExistingPrimary(image)}
                          >
                            Set as primary
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={imageBusy}
                          className="ml-3 mt-2 text-xs text-[#8b4033]"
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
                  <ImagePlus size={16} />
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
                      className="button-primary inline-flex items-center gap-2"
                      title={
                        !editing
                          ? "Save the product first to upload its image"
                          : undefined
                      }
                      onClick={() => uploadImage(editing)}
                    >
                      <Upload size={15} />
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
                className="button-secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button disabled={busy} className="button-primary cursor-pointer">
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
