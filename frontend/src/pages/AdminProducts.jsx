import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

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
  reserved_quantity: "0",
};

function apiErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        typeof item === "string" ? item : item?.msg,
      )
      .filter(Boolean);

    if (messages.length) {
      return messages.join("; ");
    }
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
  const [inventoryByProductId, setInventoryByProductId] =
  useState({});

  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const PRODUCTS_PER_PAGE = 10;

  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPrimary, setSelectedPrimary] =
    useState(false);

  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");

  const { notice, notify, clear } =
    useAdminNotice();

  const imagePreview = useMemo(
    () =>
      selectedFile
        ? URL.createObjectURL(selectedFile)
        : "",
    [selectedFile],
  );

  useEffect(
    () => () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    [imagePreview],
  );

  const load = useCallback(async () => {
    try {
      const [
        productResponse,
        categoryResponse,
      ] = await Promise.all([
        api.get("/products/"),
        api.get("/categories/"),
      ]);

      const productList = productResponse.data;

      setProducts(productList);
      setCategories(categoryResponse.data);

      const inventoryEntries = await Promise.all(
        productList.map(async (product) => {
          try {
            const response = await api.get(
              `/products/${product.id}/inventory`,
            );

            return [
              product.id,
              response.data,
            ];
          } catch {
            return [
              product.id,
              {
                quantity: product.stock ?? 0,
                reserved_quantity: 0,
              },
            ];
          }
        }),
      );

      setInventoryByProductId(
        Object.fromEntries(inventoryEntries),
      );
    } catch (error) {
      notify(
        apiErrorMessage(
          error,
          "Unable to load products.",
        ),
        "error",
      );
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
            description:
              product.description || "",
            brand: product.brand || "",
            price: product.price,
            category_id: String(
              product.category_id,
            ),
            stock: product.stock,
            reserved_quantity:
              inventoryByProductId[product.id]
                ?.reserved_quantity ?? 0,
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
        .get(
          `/products/${product.id}/images`,
        )
        .then((response) =>
          setImages(response.data),
        )
        .catch((error) =>
          setImageError(
            apiErrorMessage(
              error,
              "Unable to load product images.",
            ),
          ),
        )
        .finally(() =>
          setImagesLoading(false),
        );
    } else {
      setImagesLoading(false);
    }
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    setImageError("");
    setImageSuccess("");

    if (!file) {
      return;
    }

    if (
      !new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]).has(file.type)
    ) {
      setSelectedFile(null);
      setImageError(
        "Choose a JPG, JPEG, PNG, or WebP image.",
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setImageError(
        "Choose an image that is 10 MB or smaller.",
      );
      return;
    }

    setSelectedFile(file);

    setSelectedPrimary(
      !images.some(
        (image) => image.is_primary,
      ),
    );
  };

  const uploadImage = async (
    productId,
    file = selectedFile,
    primary = selectedPrimary,
  ) => {
    if (!file) {
      return;
    }

    setImageBusy(true);
    setImageError("");
    setImageSuccess("");

    const data = new FormData();

    data.append("file", file);
    data.append(
      "is_primary",
      String(primary),
    );
    data.append(
      "display_order",
      String(images.length),
    );

    try {
      await api.post(
        `/products/${productId}/images/upload`,
        data,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        },
      );

      const response = await api.get(
        `/products/${productId}/images`,
      );

      setImages(response.data);
      setSelectedFile(null);

      setImageSuccess(
        "Image uploaded successfully.",
      );

      notify("Product image uploaded.");
    } catch (error) {
      const message = apiErrorMessage(
        error,
        "Unable to upload this image.",
      );

      setImageError(message);

      throw error;
    } finally {
      setImageBusy(false);
    }
  };

  const setExistingPrimary = async (
    image,
  ) => {
    if (image.is_primary) {
      return;
    }

    setImageBusy(true);
    setImageError("");

    try {
      const response = await api.patch(
        `/products/${editing}/images/${image.id}`,
        {
          is_primary: true,
        },
      );

      setImages((current) =>
        current.map((item) => ({
          ...item,
          is_primary:
            item.id === response.data.id,
        })),
      );

      notify("Primary image updated.");
    } catch (error) {
      setImageError(
        apiErrorMessage(
          error,
          "Unable to update the primary image.",
        ),
      );
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = async (image) => {
    if (
      !window.confirm(
        "Remove this product image?",
      )
    ) {
      return;
    }

    setImageBusy(true);
    setImageError("");

    try {
      await api.delete(
        `/products/${editing}/images/${image.id}`,
      );

      const response = await api.get(
        `/products/${editing}/images`,
      );

      setImages(response.data);

      notify("Product image removed.");
    } catch (error) {
      setImageError(
        apiErrorMessage(
          error,
          "Unable to remove this image.",
        ),
      );
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
      description:
        form.description || null,
      brand: form.brand || null,
      price: Number(form.price),
      category_id: Number(form.category_id),
      stock: Number(form.stock),
    };

    try {
      const response = editing
        ? await api.put(
            `/products/${editing}`,
            payload,
          )
        : await api.post(
            "/products/",
            payload,
          );

      const productId = response.data.id;

      await api.put(
        `/products/${productId}/inventory`,
        {
          quantity: Number(form.stock),
          reserved_quantity: Number(
            form.reserved_quantity,
          ),
        },
      );

      setEditing(productId);
      setPage(1);

      await load();

      if (selectedFile) {
        try {
          await uploadImage(
            productId,
            selectedFile,
            selectedPrimary,
          );
        } catch {
          notify(
            "Product saved, but the image still needs to be uploaded.",
            "error",
          );

          return;
        }
      }

      setOpen(false);

      notify(
        editing
          ? "Product updated."
          : "Product created.",
      );
    } catch (error) {
      notify(
        apiErrorMessage(
          error,
          "Product could not be saved.",
        ),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (
    product,
  ) => {
    if (
      !window.confirm(
        `Deactivate “${product.name}”?`,
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/products/${product.id}`,
      );

      notify("Product deactivated.");

      setPage(1);

      await load();
    } catch (error) {
      notify(
        apiErrorMessage(
          error,
          "Could not deactivate product.",
        ),
        "error",
      );
    }
  };

  // Search the COMPLETE product list first.
  const filtered = products.filter(
    (product) =>
      `${product.name} ${
        product.brand || ""
      } ${product.slug}`
        .toLowerCase()
        .includes(term.toLowerCase()),
  );

  // Pagination happens AFTER searching.
  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length /
        PRODUCTS_PER_PAGE,
    ),
  );

  const startIndex =
    (page - 1) *
    PRODUCTS_PER_PAGE;

  const paginatedProducts =
    filtered.slice(
      startIndex,
      startIndex +
        PRODUCTS_PER_PAGE,
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

      <AdminNotice
        notice={notice}
        onClose={clear}
      />

      <AdminPanel>
        <div className="flex items-center justify-between gap-4 border-b border-[#E3E5DF] p-4">
          <label className="flex max-w-sm flex-1 items-center gap-2 rounded-xl border border-[#E3E5DF] px-3">
            <Search
              size={16}
              className="text-[#737A74]"
            />

            <input
              aria-label="Search products"
              className="w-full bg-transparent py-2 text-sm outline-none"
              placeholder="Search name or brand"
              value={term}
              onChange={(event) => {
                setTerm(
                  event.target.value,
                );

                // Always start from page 1
                // when the search changes.
                setPage(1);
              }}
            />
          </label>

          <span className="text-xs text-[#737A74]">
            {filtered.length} products
          </span>
        </div>

        {filtered.length ? (
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
              {paginatedProducts.map(
                (product) => (
                  <tr
                    key={product.id}
                  >
                    <td className="px-5 py-4">
                      <span className="font-medium">
                        {product.name}
                      </span>

                      <span className="mt-1 block text-xs text-[#737A74]">
                        {product.slug}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {product.brand ||
                        "—"}
                    </td>

                    <td className="px-5 py-4">
                      {categories.find(
                        (category) =>
                          category.id ===
                          product.category_id,
                      )?.name || "—"}
                    </td>

                    <td className="px-5 py-4">
                      ₹
                      {Number(
                        product.price,
                      ).toLocaleString(
                        "en-IN",
                      )}
                    </td>

                      <td className="px-5 py-4">
                        {(() => {
                          const inventory =
                            inventoryByProductId[product.id];

                          const stock = Number(
                            inventory?.quantity ?? product.stock ?? 0,
                          );

                          const reserved = Number(
                            inventory?.reserved_quantity ?? 0,
                          );

                          const available = Math.max(
                            0,
                            stock - reserved,
                          );

                          return (
                            <div className="w-32 space-y-1.5 text-xs">
                              <div className="grid grid-cols-[1fr_40px] items-center gap-2">
                                <span className="text-[#737A74]">
                                  Stock
                                </span>

                                <span className="flex h-8 w-10 items-center justify-center rounded-full bg-[#DCE7DE] font-semibold text-[#486B57]">
                                  {stock}
                                </span>
                              </div>

                              <div className="grid grid-cols-[1fr_40px] items-center gap-2">
                                <span className="text-[#737A74]">
                                  Reserved
                                </span>

                                <span className="text-center font-medium text-[#8b4033]">
                                  {reserved}
                                </span>
                              </div>

                              <div className="grid grid-cols-[1fr_40px] items-center gap-2">
                                <span className="text-[#737A74]">
                                  Available
                                </span>

                                <span className="text-center font-semibold text-[#486B57]">
                                  {available}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          aria-label={`Edit ${product.name}`}
                          className="rounded-lg p-2 hover:bg-[#DCE7DE] cursor-pointer"
                          onClick={() =>
                            show(product)
                          }
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                        <button
                          aria-label={`Deactivate ${product.name}`}
                          className="rounded-lg p-2 text-[#8b4033] hover:bg-[#f8e8e3] cursor-pointer"
                          onClick={() =>
                            removeProduct(
                              product,
                            )
                          }
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </AdminTable>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-[#E3E5DF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#737A74]">
                  Showing{" "}
                  {startIndex + 1}{" "}
                  to{" "}
                  {Math.min(
                    startIndex +
                      PRODUCTS_PER_PAGE,
                    filtered.length,
                  )}{" "}
                  of {filtered.length}{" "}
                  products
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1,
                          ),
                      )
                    }
                    className="rounded-lg border border-[#E3E5DF] px-3 py-2 text-sm font-medium text-[#486B57] transition hover:bg-[#F0F4EF] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-sm text-[#737A74]">
                    Page {page} of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      page ===
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1,
                          ),
                      )
                    }
                    className="rounded-lg border border-[#E3E5DF] px-3 py-2 text-sm font-medium text-[#486B57] transition hover:bg-[#F0F4EF] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <AdminEmpty>
            No products match this search.
          </AdminEmpty>
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
                {editing
                  ? "Edit product"
                  : "Add product"}
              </h2>

              <button
                type="button"
                className="text-sm text-[#486B57] cursor-pointer"
                onClick={() =>
                  setOpen(false)
                }
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
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
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
                    setForm({
                      ...form,
                      slug: event.target.value,
                    })
                  }
                />
              </AdminField>

              <AdminField label="Brand">
                <input
                  className="field mt-2"
                  value={form.brand}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      brand: event.target.value,
                    })
                  }
                />
              </AdminField>

              <AdminField label="Category">
                <select
                  required
                  className="field mt-2"
                  value={
                    form.category_id
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category_id:
                        event.target.value,
                    })
                  }
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ),
                  )}
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
                    setForm({
                      ...form,
                      price: event.target.value,
                    })
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
                    setForm({
                      ...form,
                      stock: event.target.value,
                    })
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
                    setForm({
                      ...form,
                      reserved_quantity:
                        event.target.value,
                    })
                  }
                />
              </AdminField>

              <div className="sm:col-span-2">
                <AdminField label="Description">
                  <textarea
                    className="field mt-2 min-h-24"
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target.value,
                      })
                    }
                  />
                </AdminField>
              </div>
            </div>

            <section className="mt-7 border-t border-[#E3E5DF] pt-5">
              <div>
                <h3 className="font-semibold">
                  Product images
                </h3>

                <p className="mt-1 text-xs leading-5 text-[#737A74]">
                  Choose JPG, JPEG, PNG,
                  or WebP images up to
                  10 MB.
                </p>
              </div>

              {imagesLoading ? (
                <p
                  role="status"
                  className="mt-4 text-sm text-[#737A74]"
                >
                  Loading existing
                  images…
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {images.map(
                    (image) => (
                      <div
                        key={image.id}
                        className="flex gap-3 rounded-xl border border-[#E3E5DF] p-3"
                      >
                        <img
                          src={
                            image.image_url
                          }
                          alt="Product"
                          className="h-20 w-20 shrink-0 rounded-lg bg-[#F0F1EC] object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-xs text-[#737A74]"
                            title={
                              image.image_url
                            }
                          >
                            {
                              image.image_url
                            }
                          </p>

                          {image.is_primary ? (
                            <Badge>
                              Primary image
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                imageBusy
                              }
                              className="mt-2 text-xs font-medium text-[#486B57]"
                              onClick={() =>
                                setExistingPrimary(
                                  image,
                                )
                              }
                            >
                              Set as primary
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={
                              imageBusy
                            }
                            className="ml-3 mt-2 text-xs text-[#8b4033]"
                            onClick={() =>
                              removeImage(
                                image,
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-dashed border-[#B8C7BA] p-4">
                <label className="button-secondary inline-flex cursor-pointer items-center gap-2">
                  <ImagePlus
                    size={16}
                  />

                  Choose image

                  <input
                    className="sr-only"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={
                      selectImage
                    }
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
                        {
                          selectedFile.name
                        }
                      </p>

                      <p className="mt-1 text-xs text-[#737A74]">
                        {(
                          selectedFile.size /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>

                      <label className="mt-2 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={
                            selectedPrimary
                          }
                          onChange={(
                            event,
                          ) =>
                            setSelectedPrimary(
                              event.target
                                .checked,
                            )
                          }
                        />

                        Set as primary
                        image
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        imageBusy ||
                        !editing
                      }
                      className="button-primary inline-flex items-center gap-2"
                      title={
                        !editing
                          ? "Save the product first to upload its image"
                          : undefined
                      }
                      onClick={() =>
                        uploadImage(
                          editing,
                        )
                      }
                    >
                      <Upload
                        size={15}
                      />

                      {imageBusy
                        ? "Uploading…"
                        : "Upload image"}
                    </button>
                  </div>
                )}

                <div className="sm:col-span-2 rounded-xl border border-[#E3E5DF] bg-[#F7F9F6] p-4">
                  <div className="flex items-center justify-between">
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
                        Number(form.stock) -
                          Number(form.reserved_quantity) >
                        0
                          ? "text-[#486B57]"
                          : "text-[#8b4033]"
                      }`}
                    >
                      {Math.max(
                        0,
                        Number(form.stock) -
                          Number(form.reserved_quantity),
                      )}
                    </span>
                  </div>
                </div>

                {!editing && (
                  <p className="mt-3 text-xs text-[#737A74]">
                    Save the product
                    first; the selected
                    image will then upload
                    automatically.
                  </p>
                )}
              </div>

              {imageError && (
                <p
                  role="alert"
                  className="mt-3 text-sm text-[#8b4033]"
                >
                  {imageError}
                </p>
              )}

              {imageSuccess && (
                <p
                  role="status"
                  className="mt-3 text-sm text-[#486B57]"
                >
                  {imageSuccess}
                </p>
              )}
            </section>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  setOpen(false)
                }
              >
                Cancel
              </button>

              <button
                disabled={busy}
                className="button-primary cursor-pointer"
              >
                {busy
                  ? "Saving…"
                  : "Save product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AdminProducts;