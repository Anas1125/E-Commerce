import { useCallback, useEffect, useMemo, useState } from "react";
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

const blank = {
  name: "",
  is_active: true,
};

function apiErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return (
      detail
        .map((item) => item?.msg || item)
        .filter(Boolean)
        .join("; ") || fallback
    );
  }

  return fallback;
}

function AdminBrands() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const { notice, notify, clear } = useAdminNotice();

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const load = useCallback(() => {
    api
      .get("/brands/")
      .then((response) => setRows(response.data))
      .catch((error) =>
        notify(apiErrorMessage(error, "Unable to load brands."), "error"),
      );
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const start = (brand) => {
    setSelectedFile(null);
    setEdit(brand || null);

    setForm(
      brand
        ? {
            name: brand.name,
            is_active: brand.is_active,
          }
        : blank,
    );
  };

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (
      ![".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(extension)
    ) {
      notify("Choose a JPG, JPEG, PNG, WebP, GIF, or SVG image.", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify("Choose an image that is 10 MB or smaller.", "error");
      return;
    }

    setSelectedFile(file);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      let brand;

      if (edit) {
        const response = await api.put(`/brands/${edit.id}`, form);
        brand = response.data;
      } else {
        const response = await api.post("/brands/", form);
        brand = response.data;
      }

      if (selectedFile) {
        const data = new FormData();
        data.append("file", selectedFile);

        await api.post(`/brands/${brand.id}/logo/upload`, data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      const wasEditing = Boolean(edit);

      start(null);

      notify(wasEditing ? "Brand updated." : "Brand created.");

      await load();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to save brand."), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (brand) => {
    if (!window.confirm(`Delete "${brand.name}"?`)) return;

    try {
      await api.delete(`/brands/${brand.id}`);

      notify("Brand deleted.");
      await load();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Brand could not be deleted."),
        "error",
      );
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Brands"
        description="Manage store brands and their logos."
      />

      <AdminNotice notice={notice} onClose={clear} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <AdminPanel className="h-fit">
          {rows.length ? (
            <AdminTable headers={["Brand", "Status", "Actions"]}>
              {rows.map((brand) => (
                <tr key={brand.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {brand.logo_url ? (
                        <img
                          src={resolveMediaUrl(brand.logo_url)}
                          alt=""
                          className="h-12 w-12 rounded-lg border border-[#E0E0E0] bg-white object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#F1F3F6] text-sm font-semibold text-[#2874F0]">
                          {brand.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}

                      <span className="font-medium">{brand.name}</span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={
                        brand.is_active
                          ? "rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-medium text-[#388E3C]"
                          : "rounded-full bg-[#F1F3F6] px-3 py-1 text-xs font-medium text-[#878787]"
                      }
                    >
                      {brand.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => start(brand)}
                        aria-label={`Edit ${brand.name}`}
                        className="rounded-lg p-2 hover:bg-[#F1F3F6]"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={() => remove(brand)}
                        aria-label={`Delete ${brand.name}`}
                        className="rounded-lg p-2 text-[#D32F2F] hover:bg-[#FFEBEE]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <AdminEmpty>No brands yet.</AdminEmpty>
          )}
        </AdminPanel>

        <AdminPanel className="h-fit p-5">
          <h2 className="font-semibold">
            {edit ? "Edit brand" : "Add brand"}
          </h2>

          <form className="mt-4 space-y-4" onSubmit={save}>
            <label className="block text-sm font-medium">
              Brand name

              <input
                required
                maxLength={100}
                className="field mt-2"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
              />
            </label>

            <div>
              <span className="block text-sm font-medium">Brand logo</span>

              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#B8C7BA] bg-[#F8F8F5] px-4 py-5 text-center hover:bg-[#F0F1EC]">
                {previewUrl || edit?.logo_url ? (
                  <img
                    src={previewUrl || resolveMediaUrl(edit.logo_url)}
                    alt="Brand logo preview"
                    className="h-28 w-full max-w-sm rounded-lg object-contain"
                  />
                ) : (
                  <span className="flex h-28 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-lg bg-[#F1F3F6] text-sm text-[#737A74]">
                    <ImagePlus size={22} />
                    Choose a logo from this computer
                  </span>
                )}

                <input
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.svg,image/*"
                  onChange={chooseLogo}
                />
              </label>

              <div className="mt-2 flex min-h-6 items-center justify-between gap-3 text-xs text-[#737A74]">
                {selectedFile ? (
                  <span className="min-w-0 truncate">
                    Selected: {selectedFile.name}
                  </span>
                ) : (
                  <span>JPG, PNG, WebP, GIF, or SVG · up to 10 MB</span>
                )}

                {(selectedFile || edit?.logo_url) && (
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 text-[#D32F2F]"
                    onClick={() => {
                      setSelectedFile(null);

                      if (edit) {
                        setEdit({
                          ...edit,
                          logo_url: "",
                        });
                      }
                    }}
                  >
                    <X size={14} />
                    Remove logo
                  </button>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  setForm({
                    ...form,
                    is_active: event.target.checked,
                  })
                }
              />
              Active brand
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                className="button-primary inline-flex items-center gap-2"
              >
                {selectedFile && <Upload size={15} />}

                {busy
                  ? selectedFile
                    ? "Uploading and saving…"
                    : "Saving…"
                  : edit
                    ? selectedFile
                      ? "Upload and save changes"
                      : "Save changes"
                    : selectedFile
                      ? "Upload and create brand"
                      : "Create brand"}
              </button>

              {edit && (
                <button
                  type="button"
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
    </>
  );
}

export default AdminBrands;