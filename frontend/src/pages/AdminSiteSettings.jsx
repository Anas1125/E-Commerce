import { useContext, useEffect, useRef, useState } from "react";

import { ImagePlus, Trash2, Upload, X } from "lucide-react";

import { SiteBrandingContext } from "../context/site-branding-context";

import api from "../services/api";

import {
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
} from "../components/AdminUI";

import useAdminNotice from "../hooks/useAdminNotice";

const DEFAULT_SITE_NAME = "TerraLens";
const DEFAULT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const assets = [
  {
    key: "navbar_logo",
    title: "Navbar logo",
    field: "navbar_logo_url",
    hint: "Shown in the customer storefront navigation.",
  },
  {
    key: "hero_image",
    title: "Homepage hero image",
    field: "hero_image_url",
    hint: "Used as the background image for the homepage hero.",
  },
  {
    key: "footer_logo",
    title: "Footer logo",
    field: "footer_logo_url",
    hint: "Optional logo shown in the customer storefront footer.",
  },
  {
    key: "favicon",
    title: "Favicon",
    field: "favicon_url",
    hint: "Shown in the browser tab. PNG, WebP, and ICO files are accepted.",
    favicon: true,
    accept:
      ".png,.ico,.webp,image/png,image/x-icon,image/vnd.microsoft.icon,image/webp",
    extensions: [".png", ".ico", ".webp"],
  },
];

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

function AdminSiteSettings() {
  const [settings, setSettings] = useState({});
  // key -> { file, url } — url is the local blob preview, created in the handler
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);
  const [savingSiteName, setSavingSiteName] = useState(false);

  const { notice, notify, clear } = useAdminNotice();

  const { refreshBranding } = useContext(SiteBrandingContext) ?? {};

  const filesRef = useRef({});

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Revoke any remaining blob URLs when the page unmounts
  useEffect(
    () => () => {
      Object.values(filesRef.current).forEach((entry) =>
        URL.revokeObjectURL(entry.url),
      );
    },
    [],
  );

  // Fetch lives inside the effect; state is only set in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api
      .get("/site-settings/")
      .then((response) => {
        if (cancelled) return;
        const data = response.data || {};
        setSettings(data);
        setSiteName(data.site_name || DEFAULT_SITE_NAME);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const message = apiErrorMessage(
          error,
          "Unable to load site settings.",
        );
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

  const retry = () => {
    setLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  };

  const syncBranding = async () => {
    if (!refreshBranding) return true;
    try {
      await refreshBranding();
      return true;
    } catch {
      return false;
    }
  };

  const discardFile = (key) => {
    const existing = filesRef.current[key];
    if (existing) URL.revokeObjectURL(existing.url);
    setFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const chooseFile = (key, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const parts = file.name.split(".");
    const extension = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : "";

    const acceptedExtensions =
      assets.find((asset) => asset.key === key)?.extensions ||
      DEFAULT_EXTENSIONS;

    if (!acceptedExtensions.includes(extension)) {
      notify(
        key === "favicon"
          ? "Choose a PNG, WebP, or ICO favicon."
          : "Choose a JPG, JPEG, PNG, or WebP image.",
        "error",
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      notify("Choose an image that is 10 MB or smaller.", "error");
      return;
    }

    const existing = filesRef.current[key];
    if (existing) URL.revokeObjectURL(existing.url);

    setFiles((current) => ({
      ...current,
      [key]: { file, url: URL.createObjectURL(file) },
    }));
  };

  const savedSiteName = settings.site_name || DEFAULT_SITE_NAME;
  const siteNameChanged = siteName.trim() !== savedSiteName;

  const saveSiteName = async (event) => {
    event.preventDefault();
    if (savingSiteName) return;

    const trimmedName = siteName.trim();

    if (!trimmedName) {
      notify("Website name cannot be empty.", "error");
      return;
    }

    setSavingSiteName(true);

    try {
      const response = await api.patch("/site-settings/name", {
        site_name: trimmedName,
      });

      setSettings(response.data);
      setSiteName(response.data.site_name || trimmedName);

      const synced = await syncBranding();
      notify(
        synced
          ? "Website name saved."
          : "Website name saved, but the storefront branding could not be refreshed.",
        synced ? "success" : "error",
      );
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to update the website name."),
        "error",
      );
    } finally {
      setSavingSiteName(false);
    }
  };

  const setAssetBusy = (key, value) =>
    setBusy((current) => ({ ...current, [key]: value }));

  const upload = async (asset) => {
    const entry = files[asset.key];

    if (!entry || busy[asset.key]) return;

    setAssetBusy(asset.key, true);

    try {
      const data = new FormData();
      data.append("file", entry.file);

      // Don't set Content-Type manually; the browser/axios adds the boundary
      const response = await api.post(
        `/site-settings/${asset.key}/upload`,
        data,
      );

      setSettings(response.data);
      discardFile(asset.key);

      const synced = await syncBranding();
      notify(
        synced
          ? `${asset.title} saved.`
          : `${asset.title} saved, but the storefront branding could not be refreshed.`,
        synced ? "success" : "error",
      );
    } catch (error) {
      notify(
        apiErrorMessage(
          error,
          `Unable to save ${asset.title.toLowerCase()}.`,
        ),
        "error",
      );
    } finally {
      setAssetBusy(asset.key, false);
    }
  };

  const remove = async (asset) => {
    if (busy[asset.key]) return;
    if (
      !window.confirm(
        `Remove the ${asset.title.toLowerCase()}? It will disappear from the storefront.`,
      )
    ) {
      return;
    }

    setAssetBusy(asset.key, true);

    try {
      const response = await api.delete(`/site-settings/${asset.key}`);

      setSettings(response.data);
      discardFile(asset.key);

      const synced = await syncBranding();
      notify(
        synced
          ? `${asset.title} removed.`
          : `${asset.title} removed, but the storefront branding could not be refreshed.`,
        synced ? "success" : "error",
      );
    } catch (error) {
      notify(
        apiErrorMessage(
          error,
          `Unable to remove ${asset.title.toLowerCase()}.`,
        ),
        "error",
      );
    } finally {
      setAssetBusy(asset.key, false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Site Settings"
        description="Manage your website name and the images used to brand your customer storefront."
      />

      <AdminNotice notice={notice} onClose={clear} />

      {loading ? (
        <AdminPanel className="p-6">
          <p role="status" className="text-sm text-[#737A74]">
            Loading site settings…
          </p>
        </AdminPanel>
      ) : loadError ? (
        <AdminPanel className="p-6">
          <div role="alert" className="text-sm text-[#8b4033]">
            {loadError}
          </div>
          <button
            type="button"
            onClick={retry}
            className="button-secondary mt-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
          >
            Retry
          </button>
        </AdminPanel>
      ) : (
        <div className="space-y-5">
          {/* Website Name */}
          <AdminPanel className="p-5 sm:p-6">
            <div>
              <h2 className="font-semibold">Website Name</h2>

              <p className="mt-1 text-sm text-[#737A74]">
                Change the name displayed across your customer storefront.
              </p>
            </div>

            <form
              onSubmit={saveSiteName}
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label
                  htmlFor="site-name"
                  className="mb-2 block text-sm font-medium text-[#4B514C]"
                >
                  Name
                </label>

                <input
                  id="site-name"
                  type="text"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  maxLength={150}
                  placeholder="Enter website name"
                  className="w-full rounded-xl border border-[#D8DDD7] bg-white px-4 py-3 text-sm text-[#303630] outline-none transition placeholder:text-[#A1A7A1] focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/10"
                />

                <p className="mt-2 text-xs text-[#737A74]">
                  Maximum 150 characters.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingSiteName || !siteNameChanged}
                className="button-primary inline-flex cursor-pointer items-center justify-center gap-2 sm:min-w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
              >
                {savingSiteName ? "Saving…" : "Save name"}
              </button>
            </form>
          </AdminPanel>

          {/* Branding Assets */}
          <div className="grid gap-5 xl:grid-cols-2">
            {assets.map((asset) => {
              const selected = files[asset.key];
              const preview = selected?.url;
              const currentUrl = settings[asset.field];
              const busyNow = Boolean(busy[asset.key]);

              return (
                <AdminPanel key={asset.key} className="p-5 sm:p-6">
                  <div>
                    <h2 className="font-semibold">{asset.title}</h2>
                    <p className="mt-1 text-sm text-[#737A74]">{asset.hint}</p>
                  </div>

                  <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-[#B8C7BA] bg-[#F8F8F5] p-4 sm:flex-row sm:justify-start sm:gap-5">
                    {preview || currentUrl ? (
                      <img
                        src={preview || currentUrl}
                        alt={`${asset.title} preview`}
                        className={
                          asset.favicon
                            ? "h-10 w-10 rounded-md object-contain"
                            : "max-h-32 max-w-full rounded-lg object-contain sm:max-w-[45%]"
                        }
                      />
                    ) : (
                      <div
                        className={`flex items-center justify-center rounded-lg bg-[#E9ECE5] text-[#737A74] ${
                          asset.favicon ? "h-10 w-10" : "h-24 w-full sm:w-36"
                        }`}
                      >
                        <ImagePlus
                          size={asset.favicon ? 17 : 25}
                          aria-hidden="true"
                        />
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-0 sm:justify-start">
                      <label className="button-secondary inline-flex cursor-pointer items-center gap-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-[#486B57]">
                        <ImagePlus size={15} aria-hidden="true" />
                        Choose image
                        <input
                          className="sr-only"
                          type="file"
                          disabled={busyNow}
                          accept={
                            asset.accept ||
                            ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          }
                          onChange={(event) => chooseFile(asset.key, event)}
                        />
                      </label>

                      {preview && (
                        <>
                          <button
                            type="button"
                            disabled={busyNow}
                            className="button-primary inline-flex cursor-pointer items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                            onClick={() => upload(asset)}
                          >
                            <Upload size={15} aria-hidden="true" />
                            {busyNow ? "Saving…" : "Save image"}
                          </button>

                          <button
                            type="button"
                            disabled={busyNow}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E3E5DF] px-4 py-2 text-sm text-[#5C655E] hover:bg-[#F5F5F1] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                            onClick={() => discardFile(asset.key)}
                          >
                            <X size={15} aria-hidden="true" />
                            Discard
                          </button>
                        </>
                      )}

                      {currentUrl && !preview && (
                        <button
                          type="button"
                          disabled={busyNow}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E3E5DF] px-4 py-2 text-sm text-[#8b4033] hover:bg-[#f8e8e3] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]"
                          onClick={() => remove(asset)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          {busyNow ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>

                  {preview && (
                    <p className="mt-2 text-xs text-[#737A74]">
                      Preview: {selected.file.name}. Select Save image to apply
                      it.
                    </p>
                  )}
                </AdminPanel>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default AdminSiteSettings;