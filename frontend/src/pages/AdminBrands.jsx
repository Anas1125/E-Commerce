import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2, Upload, X } from "lucide-react";

import useAdminNotice from "../hooks/useAdminNotice";
import api, { resolveMediaUrl } from "../services/api";
import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
} from "../components/AdminUI";

const BLANK = {
  name: "",
  is_active: true,
};

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const UPLOAD_TIMEOUT_MS = 120000;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function apiErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean);

    if (messages.length) return messages.join("; ");
  }

  return error.response
    ? fallback
    : "Network problem. Check your connection and try again.";
}

async function fetchBrands() {
  const response = await api.get("/brands/admin/all");

  return Array.isArray(response.data) ? response.data : [];
}

function Modal({
  title,
  onClose,
  closeDisabled = false,
  widthClass = "sm:max-w-md",
  children,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    if (dialog && !dialog.contains(document.activeElement)) {
      (dialog.querySelector(FOCUSABLE) || dialog).focus();
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!closeDisabledRef.current) onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const items = Array.from(dialog.querySelectorAll(FOCUSABLE));

      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

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
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-2xl sm:p-6 ${widthClass}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
            className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#486B57] transition hover:bg-[#DCE7DE] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}

function BrandLogo({ url, name }) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={resolveMediaUrl(url)}
        alt=""
        onError={() => setFailed(true)}
        className="h-12 w-12 shrink-0 rounded-lg border border-[#E0E0E0] bg-white object-contain p-1"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F1F3F6] text-sm font-semibold text-[#2874F0]"
    >
      {name?.charAt(0)?.toUpperCase()}
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={
        active
          ? "inline-block rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-medium text-[#2E7D32]"
          : "inline-block rounded-full bg-[#F1F3F6] px-3 py-1 text-xs font-medium text-[#5B625C]"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function BrandActions({ brand, disabled, onEdit, onDelete, variant }) {
  const isCard = variant === "card";

  const base = isCard
    ? "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={isCard ? "mt-4 grid grid-cols-2 gap-2" : "flex gap-1"}>
      <button
        type="button"
        onClick={() => onEdit(brand)}
        disabled={disabled}
        aria-label={`Edit ${brand.name}`}
        className={`${base} ${
          isCard ? "border-[#D6D9D5]" : ""
        } text-[#1F2521] hover:bg-[#F1F3F6]`}
      >
        <Pencil size={16} aria-hidden="true" />
        {isCard && <span>Edit</span>}
      </button>

      <button
        type="button"
        onClick={() => onDelete(brand)}
        disabled={disabled}
        aria-label={`Delete ${brand.name}`}
        className={`${base} ${
          isCard ? "border-[#FFCDD2]" : ""
        } text-[#D32F2F] hover:bg-[#FFEBEE]`}
      >
        <Trash2 size={16} aria-hidden="true" />
        {isCard && <span>Delete</span>}
      </button>
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]"
    >
      {message}
    </div>
  );
}

function AdminBrands() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);

  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { notice, notify, clear } = useAdminNotice();

  const requestId = useRef(0);

  const previewRef = useRef("");

  const setFile = (file) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);

    const url = file ? URL.createObjectURL(file) : "";

    previewRef.current = url;
    setSelectedFile(file);
    setPreviewUrl(url);
  };

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;

    try {
      const list = await fetchBrands();

      if (id !== requestId.current) return;

      setRows(list);
      setLoadError("");
    } catch (error) {
      if (id !== requestId.current) return;

      setLoadError(apiErrorMessage(error, "Unable to load brands."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = ++requestId.current;

    fetchBrands()
      .then((list) => {
        if (id === requestId.current) setRows(list);
      })
      .catch((error) => {
        if (id === requestId.current) {
          setLoadError(apiErrorMessage(error, "Unable to load brands."));
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });

    return () => {
      requestId.current += 1;
    };
  }, []);

  const retry = () => {
    setLoading(true);
    setLoadError("");
    load();
  };

  const openDialog = (brand) => {
    setFile(null);
    setRemoveLogo(false);
    setFormError("");
    setEdit(brand || null);
    setForm(
      brand
        ? { name: brand.name || "", is_active: Boolean(brand.is_active) }
        : BLANK,
    );
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEdit(null);
    setForm(BLANK);
    setFormError("");
    setRemoveLogo(false);
    setFile(null);
  };

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFormError("Choose a JPG, JPEG, PNG, WebP, GIF, or SVG image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormError("Choose an image that is 10 MB or smaller.");
      return;
    }

    setFormError("");
    setRemoveLogo(false);
    setFile(file);
  };

  const hasExistingLogo = Boolean(edit?.logo_url) && !removeLogo;
  const showPreview = Boolean(previewUrl) || hasExistingLogo;

  const save = async (event) => {
    event.preventDefault();

    if (busy) return;

    const name = form.name.trim();

    if (!name) {
      setFormError("Enter a brand name.");
      return;
    }

    setFormError("");
    setBusy(true);

    const wasEditing = Boolean(edit);

    try {
      const payload = { name, is_active: form.is_active };

      if (wasEditing && removeLogo && !selectedFile) {
        payload.logo_url = null;
      }

      const response = wasEditing
        ? await api.put(`/brands/${edit.id}`, payload)
        : await api.post("/brands/", payload);

      const saved = response.data;

      if (selectedFile) {
        const data = new FormData();
        data.append("file", selectedFile);

        try {
          await api.post(`/brands/${saved.id}/logo/upload`, data, {
            timeout: UPLOAD_TIMEOUT_MS,
          });
        } catch (uploadError) {
          setEdit(saved);
          setForm({
            name: saved.name ?? name,
            is_active: saved.is_active ?? form.is_active,
          });
          setRemoveLogo(false);
          setFormError(
            `Brand saved, but the logo upload failed: ${apiErrorMessage(
              uploadError,
              "Unable to upload the logo.",
            )} Press save to retry the upload.`,
          );

          await load();
          return;
        }
      }

      closeDialog();
      notify(wasEditing ? "Brand updated." : "Brand created.");

      await load();
    } catch (error) {
      setFormError(apiErrorMessage(error, "Unable to save brand."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (brand) => {
    if (deletingId !== null) return;

    if (!window.confirm(`Delete "${brand.name}"?`)) return;

    setDeletingId(brand.id);

    try {
      await api.delete(`/brands/${brand.id}`);

      notify("Brand deleted.");
      await load();
    } catch (error) {
      notify(apiErrorMessage(error, "Brand could not be deleted."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const actionsDisabled = deletingId !== null;

  let content;

  if (loading) {
    content = (
      <div
        role="status"
        className="px-5 py-12 text-center text-sm text-[#6A716B]"
      >
        Loading brands…
      </div>
    );
  } else if (loadError && !rows.length) {
    content = (
      <div role="alert" className="px-5 py-12 text-center">
        <p className="text-sm text-[#6A716B]">{loadError}</p>

        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#D6D9D5] px-4 text-sm font-semibold text-[#486B57] transition hover:bg-[#F5F5F1]"
        >
          Try again
        </button>
      </div>
    );
  } else if (!rows.length) {
    content = <AdminEmpty>No brands yet.</AdminEmpty>;
  } else {
    content = (
      <>
        {loadError && (
          <div
            role="alert"
            className="flex flex-col gap-2 border-b border-[#E3E5DF] bg-[#FFF8E1] px-4 py-3 text-sm text-[#6A4B00] sm:flex-row sm:items-center sm:justify-between"
          >
            <span>Couldn't refresh the list. Showing the last loaded data.</span>

            <button
              type="button"
              onClick={retry}
              className="cursor-pointer self-start text-sm font-semibold underline sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {/* DESKTOP / TABLET TABLE */}
        <div className="hidden overflow-x-auto md:block">
          <AdminTable headers={["Brand", "Status", "Actions"]}>
            {rows.map((brand) => (
              <tr key={brand.id}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      key={brand.logo_url || "none"}
                      url={brand.logo_url}
                      name={brand.name}
                    />

                    <span className="font-medium">{brand.name}</span>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <StatusBadge active={brand.is_active} />
                </td>

                <td className="px-5 py-4">
                  <BrandActions
                    brand={brand}
                    disabled={actionsDisabled}
                    onEdit={openDialog}
                    onDelete={remove}
                    variant="table"
                  />
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>

        {/* MOBILE CARDS */}
        <ul className="divide-y divide-[#E3E5DF] md:hidden">
          {rows.map((brand) => (
            <li key={brand.id} className="p-4">
              <div className="flex items-center gap-3">
                <BrandLogo
                  key={brand.logo_url || "none"}
                  url={brand.logo_url}
                  name={brand.name}
                />

                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{brand.name}</p>

                  <div className="mt-1">
                    <StatusBadge active={brand.is_active} />
                  </div>
                </div>
              </div>

              <BrandActions
                brand={brand}
                disabled={actionsDisabled}
                onEdit={openDialog}
                onDelete={remove}
                variant="card"
              />
            </li>
          ))}
        </ul>
      </>
    );
  }

  const saveLabel = busy
    ? selectedFile
      ? "Uploading and saving…"
      : "Saving…"
    : edit
      ? selectedFile
        ? "Upload and save changes"
        : "Save changes"
      : selectedFile
        ? "Upload and create brand"
        : "Create brand";

  return (
    <>
      <AdminPageHeader
        title="Brands"
        description="Manage store brands and their logos."
      />

      <AdminNotice notice={notice} onClose={clear} />

      <AdminPanel>
        <div className="flex items-center border-b border-[#E3E5DF] p-4 sm:justify-end">
          <button
            type="button"
            onClick={() => openDialog(null)}
            className="button-primary inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 sm:w-auto"
          >
            <Plus size={17} aria-hidden="true" />
            Add brand
          </button>
        </div>

        {content}
      </AdminPanel>

      {dialogOpen && (
        <Modal
          title={edit ? "Edit brand" : "Add brand"}
          onClose={closeDialog}
          closeDisabled={busy}
        >
          <form className="space-y-5" onSubmit={save}>
            <FormError message={formError} />

            <div>
              <label
                htmlFor="brand-name"
                className="mb-1.5 block text-sm font-medium"
              >
                Brand name
              </label>

              <input
                id="brand-name"
                required
                autoFocus
                maxLength={100}
                autoComplete="off"
                className="field"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <span className="block text-sm font-medium">Brand logo</span>

              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#B8C7BA] bg-[#F8F8F5] px-4 py-5 text-center transition hover:bg-[#F0F1EC] focus-within:ring-2 focus-within:ring-[#486B57]/40">
                {showPreview ? (
                  <img
                    key={previewUrl || edit?.logo_url}
                    src={previewUrl || resolveMediaUrl(edit.logo_url)}
                    alt="Brand logo preview"
                    className="h-28 w-full max-w-sm rounded-lg object-contain"
                  />
                ) : (
                  <span className="flex h-28 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-lg bg-[#F1F3F6] text-sm text-[#6A716B]">
                    <ImagePlus size={22} aria-hidden="true" />
                    Tap to choose a logo
                  </span>
                )}

                <input
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
                  onChange={chooseLogo}
                />
              </label>

              <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#6A716B]">
                {selectedFile ? (
                  <span className="min-w-0 truncate">
                    Selected: {selectedFile.name}
                  </span>
                ) : removeLogo ? (
                  <span>The logo will be removed when you save.</span>
                ) : (
                  <span>JPG, PNG, WebP, GIF, or SVG · up to 10 MB</span>
                )}

                {selectedFile ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setFile(null)}
                    className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 text-[#486B57] disabled:opacity-50"
                  >
                    <X size={14} aria-hidden="true" />
                    {edit?.logo_url ? "Discard new logo" : "Remove file"}
                  </button>
                ) : removeLogo ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRemoveLogo(false)}
                    className="inline-flex min-h-11 shrink-0 cursor-pointer items-center text-[#486B57] disabled:opacity-50"
                  >
                    Undo
                  </button>
                ) : hasExistingLogo ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRemoveLogo(true)}
                    className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 text-[#D32F2F] disabled:opacity-50"
                  >
                    <X size={14} aria-hidden="true" />
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 cursor-pointer"
                checked={form.is_active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              Active brand
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="button-secondary min-h-11"
                disabled={busy}
                onClick={closeDialog}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={busy}
                className="button-primary inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedFile && <Upload size={15} aria-hidden="true" />}
                {saveLabel}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default AdminBrands;