import { useEffect, useState } from "react";
import { ImagePlus, Pencil, Trash2, Upload, X } from "lucide-react";
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
  // { file, url } — url is the local blob preview, created in the handler
  const [selected, setSelected] = useState(null);
  const { notice, notify, clear } = useAdminNotice();

  const selectedFile = selected?.file ?? null;
  const previewUrl = selected?.url ?? "";

  // Revoke the blob URL whenever it is replaced or the component unmounts
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <AdminPanel className="h-fit">
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
          ) : rows.length ? (
            <AdminTable headers={["Category", "Slug", "Actions"]}>
              {rows.map((category) => (
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
                  <td className="px-5 py-4 text-[#737A74]">{category.slug}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => start(category)}
                        aria-label={`Edit ${category.name}`}
                        className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]/40 focus-visible:ring-offset-2"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(category)}
                        disabled={deletingId === category.id}
                        aria-label={`Delete ${category.name}`}
                        className="cursor-pointer rounded-lg p-2 text-[#8b4033] hover:bg-[#f8e8e3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]/40 focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <AdminEmpty>No categories yet.</AdminEmpty>
          )}
        </AdminPanel>

        <div className="sticky top-24 self-start">
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