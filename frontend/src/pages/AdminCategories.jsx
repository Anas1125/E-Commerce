import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import useAdminNotice from "../hooks/useAdminNotice";
import api, { resolveMediaUrl } from "../services/api";
import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
} from "../components/AdminUI";

const blank = { name: "", slug: "", image_url: "" };
const PAGE_SIZE = 8;
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AdminCategories() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const { notice, notify, clear } = useAdminNotice();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const selectedFile = selected?.file ?? null;
  const previewUrl = selected?.url ?? "";
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = (category) =>
    `${category.name || ""} ${category.slug || ""}`
      .toLowerCase()
      .includes(normalizedQuery);

  const filteredRows = normalizedQuery
    ? rows.filter(matchesQuery)
    : rows;

  const suggestions = normalizedQuery
    ? rows.filter(matchesQuery).slice(0, 6)
    : [];

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, pageCount);

  const visibleRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );


  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Fetch lives inside the effect; state is only set in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api
      .get("/categories/")
      .then((response) => {
        if (cancelled) return;
        setRows(Array.isArray(response.data) ? response.data : []);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const message = apiErrorMessage(error, "Unable to load categories.");
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

  const start = (category) => {
    setSelected(null);
    setEdit(category || null);
    setForm(
      category
        ? {
            name: category.name,
            slug: category.slug,
            image_url: category.image_url || "",
          }
        : blank,
    );
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const parts = file.name.split(".");
    const extension = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : "";
    if (
      !ALLOWED_EXTENSIONS.includes(extension) ||
      (file.type && !ALLOWED_TYPES.includes(file.type))
    ) {
      notify("Choose a JPG, JPEG, PNG, or WebP image.", "error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notify("Choose an image that is 10 MB or smaller.", "error");
      return;
    }
    setSelected({ file, url: URL.createObjectURL(file) });
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const slug = slugify(form.slug);
    if (!name || !slug) {
      notify("Name and a valid slug are required.", "error");
      return;
    }

    setBusy(true);
    try {
      let imageUrl = form.image_url || null;

      if (selectedFile) {
        const data = new FormData();
        data.append("file", selectedFile);
        const imageResponse = await api.post(
          "/categories/images/upload",
          data,
          { timeout: 120000 },
        );
        imageUrl = imageResponse.data.image_url;
        setForm((current) => ({ ...current, image_url: imageUrl }));
        setSelected(null);
      }

      const payload = { name, slug, image_url: imageUrl };
      const wasEditing = Boolean(edit);
      if (wasEditing) await api.put(`/categories/${edit.id}`, payload);
      else await api.post("/categories/", payload);

      start(null);
      notify(wasEditing ? "Category updated." : "Category created.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to save category."), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category) => {
    if (deletingId) return;
    if (!window.confirm(`Delete “${category.name}”?`)) return;
    setDeletingId(category.id);
    try {
      await api.delete(`/categories/${category.id}`);
      if (edit?.id === category.id) start(null);
      notify("Category deleted.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Category could not be deleted."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Blob previews must not go through resolveMediaUrl
  const shownImage = previewUrl || resolveMediaUrl(form.image_url);

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Organize the store collection by category."
      />
      <AdminNotice notice={notice} onClose={clear} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AdminPanel className="h-fit">
          <div className="border-b border-[#E3E5DF] p-4 sm:p-5">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setShowSearchSuggestions(false);
                }
              }}
            >
              <label
                htmlFor="category-search"
                className="mb-2 block text-sm font-medium text-[#212121]"
              >
                Search categories
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737A74]"
                />

                <input
                  id="category-search"
                  type="search"
                  value={searchQuery}
                  autoComplete="off"
                  placeholder="Type a category name or slug..."
                  aria-controls="category-search-suggestions"
                  aria-expanded={showSearchSuggestions && suggestions.length > 0}
                  onFocus={() => {
                    if (normalizedQuery) setShowSearchSuggestions(true);
                  }}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                    setShowSearchSuggestions(Boolean(event.target.value.trim()));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setShowSearchSuggestions(false);
                    }
                  }}
                  className="w-full min-w-0 rounded-xl border border-[#D6DCE5] bg-[#F8FAFC] py-3 pl-10 pr-10 text-sm outline-none transition focus:border-[#486B57] focus:bg-white focus:ring-2 focus:ring-[#486B57]/10"
                />

                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear category search"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                      setShowSearchSuggestions(false);
                    }}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#737A74] hover:bg-[#E8ECE6]"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {showSearchSuggestions && normalizedQuery && suggestions.length > 0 && (
                <div
                  id="category-search-suggestions"
                  role="listbox"
                  className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#E3E5DF] bg-white p-1 shadow-xl"
                >
                  {suggestions.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setSearchQuery(category.name);
                        setCurrentPage(1);
                        setShowSearchSuggestions(false);
                      }}
                      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#F5F5F1]"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-[#212121]">
                        {category.name}
                      </span>
                      <span className="shrink-0 text-xs text-[#737A74]">
                        {category.slug}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs text-[#737A74]" aria-live="polite">
                {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "category" : "categories"} found
              </p>
            </div>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-sm text-[#737A74]">
              Loading categories…
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
          ) : filteredRows.length ? (
              <>
                <div className="space-y-3 p-3 xl:p-4 2xl:hidden">
                  {visibleRows.map((category) => (
                    <article
                      key={category.id}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E3E5DF] bg-white p-3 sm:p-4"
                    >
                      {category.image_url ? (
                        <img
                          src={resolveMediaUrl(category.image_url)}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg bg-[#F5F5F1] object-cover sm:h-16 sm:w-16"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F1] text-[#737A74] sm:h-16 sm:w-16">
                          <ImagePlus size={20} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-[#212121]">
                          {category.name}
                        </p>
                        <p className="mt-1 break-all text-xs text-[#737A74]">
                          {category.slug}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => start(category)}
                          aria-label={`Edit ${category.name}`}
                          className="rounded-lg p-2 hover:bg-[#DCE7DE]"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => remove(category)}
                          disabled={deletingId === category.id}
                          aria-label={`Delete ${category.name}`}
                          className="rounded-lg p-2 text-[#8b4033] hover:bg-[#f8e8e3] disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden 2xl:block">
                  <AdminTable headers={["Category", "Slug", "Actions"]}>
                    {visibleRows.map((category) => (
                      <tr key={category.id}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {category.image_url && (
                              <img
                                src={resolveMediaUrl(category.image_url)}
                                alt=""
                                className="h-12 w-16 rounded-lg object-cover"
                              />
                            )}
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-[#737A74]">
                          {category.slug}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => start(category)}
                              aria-label={`Edit ${category.name}`}
                              className="rounded-lg p-2 hover:bg-[#DCE7DE]"
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              onClick={() => remove(category)}
                              disabled={deletingId === category.id}
                              aria-label={`Delete ${category.name}`}
                              className="rounded-lg p-2 text-[#8b4033] hover:bg-[#f8e8e3] disabled:opacity-50"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                </div>

                {/* Pagination */}
                <div className="flex flex-col gap-3 border-t border-[#E3E5DF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-xs text-[#737A74] sm:text-sm">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filteredRows.length)} of{" "}
                    {filteredRows.length}
                  </p>

                  {pageCount > 1 && (
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <button
                        type="button"
                        disabled={safePage === 1}
                        onClick={() => setCurrentPage(safePage - 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      <span className="whitespace-nowrap text-xs text-[#737A74]">
                        Page {safePage} of {pageCount}
                      </span>

                      <button
                        type="button"
                        disabled={safePage === pageCount}
                        onClick={() => setCurrentPage(safePage + 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <AdminEmpty>
                {rows.length ? (
                  <div>
                    <p>No categories match “{searchQuery}”.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                        setShowSearchSuggestions(false);
                      }}
                      className="mt-3 font-semibold text-[#486B57]"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  "No categories yet."
                )}
              </AdminEmpty>
            )}
        </AdminPanel>

        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <AdminPanel className="h-fit p-5">
            <h2 className="font-semibold">
              {edit ? "Edit category" : "Add category"}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={save}>
              <label className="block text-sm font-medium">
                Name
                <input
                  required
                  maxLength={100}
                  className="field mt-2"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm font-medium">
                Slug
                <input
                  required
                  maxLength={100}
                  className="field mt-2"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                />
              </label>
              <div>
                <span className="block text-sm font-medium">
                  Category image
                </span>
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#B8C7BA] bg-[#F8F8F5] px-4 py-5 text-center hover:bg-[#F0F1EC]">
                  {shownImage ? (
                    <img
                      src={shownImage}
                      alt="Category image preview"
                      className="aspect-[16/9] w-full max-w-sm rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-28 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-lg bg-[#E9ECE5] text-sm text-[#737A74]">
                      <ImagePlus size={22} aria-hidden="true" />
                      Choose an image from this computer
                    </span>
                  )}
                  <input
                    className="sr-only"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={chooseImage}
                  />
                </label>
                <div className="mt-2 flex min-h-6 items-center justify-between gap-3 text-xs text-[#737A74]">
                  {selectedFile ? (
                    <span className="min-w-0 truncate">
                      Selected: {selectedFile.name}
                    </span>
                  ) : (
                    <span>JPG, PNG, or WebP · up to 10 MB</span>
                  )}
                  {shownImage && (
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[#8b4033] disabled:opacity-50"
                      onClick={() => {
                        setSelected(null);
                        setForm((current) => ({ ...current, image_url: "" }));
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                      Remove image
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="button-primary inline-flex cursor-pointer items-center gap-2"
                >
                  {selectedFile && <Upload size={15} aria-hidden="true" />}
                  {busy
                    ? selectedFile
                      ? "Uploading and saving..."
                      : "Saving..."
                    : edit
                      ? selectedFile
                        ? "Upload and save changes"
                        : "Save changes"
                      : selectedFile
                        ? "Upload and create category"
                        : "Create category"}
                </button>
                {edit && (
                  <button
                    type="button"
                    disabled={busy}
                    className="button-secondary"
                    onClick={() => start(null)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </AdminPanel>
        </div>
      </div>
    </>
  );
}

export default AdminCategories;