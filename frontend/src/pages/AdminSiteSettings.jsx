import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { SiteBrandingContext } from "../context/site-branding-context";
import api from "../services/api";
import {
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
} from "../components/AdminUI";
import useAdminNotice from "../hooks/useAdminNotice";

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
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return (
      detail
        .map((item) => item?.msg || item)
        .filter(Boolean)
        .join("; ") || fallback
    );
  return fallback;
}

function AdminSiteSettings() {
  const [settings, setSettings] = useState({});
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState({});
  const [loading, setLoading] = useState(true);
  const { notice, notify, clear } = useAdminNotice();
  const { refreshBranding } = useContext(SiteBrandingContext);
  const previews = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(files).map(([key, file]) => [
          key,
          URL.createObjectURL(file),
        ]),
      ),
    [files],
  );

  useEffect(
    () => () =>
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/site-settings/");
      setSettings(response.data);
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to load site settings."), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const chooseFile = (key, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const acceptedExtensions = assets.find((asset) => asset.key === key)
      ?.extensions || [".jpg", ".jpeg", ".png", ".webp"];
    if (!acceptedExtensions.includes(extension)) {
      notify(
        key === "favicon"
          ? "Choose a PNG, WebP, or ICO favicon."
          : "Choose a JPG, JPEG, PNG, or WebP image.",
        "error",
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify("Choose an image that is 10 MB or smaller.", "error");
      return;
    }
    setFiles((current) => ({ ...current, [key]: file }));
  };

  const upload = async (asset) => {
    const file = files[asset.key];
    if (!file) return;
    setBusy((current) => ({ ...current, [asset.key]: true }));
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await api.post(
        `/site-settings/${asset.key}/upload`,
        data,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setSettings(response.data);
      setFiles((current) => {
        const next = { ...current };
        delete next[asset.key];
        return next;
      });
      await refreshBranding();
      notify(`${asset.title} saved.`);
    } catch (error) {
      notify(
        apiErrorMessage(error, `Unable to save ${asset.title.toLowerCase()}.`),
        "error",
      );
    } finally {
      setBusy((current) => ({ ...current, [asset.key]: false }));
    }
  };

  const remove = async (asset) => {
    setBusy((current) => ({ ...current, [asset.key]: true }));
    try {
      const response = await api.delete(`/site-settings/${asset.key}`);
      setSettings(response.data);
      setFiles((current) => {
        const next = { ...current };
        delete next[asset.key];
        return next;
      });
      await refreshBranding();
      notify(`${asset.title} removed.`);
    } catch (error) {
      notify(
        apiErrorMessage(
          error,
          `Unable to remove ${asset.title.toLowerCase()}.`,
        ),
        "error",
      );
    } finally {
      setBusy((current) => ({ ...current, [asset.key]: false }));
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Site Settings"
        description="Manage the images used to brand your customer storefront."
      />
      <AdminNotice notice={notice} onClose={clear} />
      {loading ? (
        <AdminPanel className="p-6">
          <p role="status" className="text-sm text-[#737A74]">
            Loading site settings…
          </p>
        </AdminPanel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {assets.map((asset) => {
            const preview = previews[asset.key];
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
                      className={`flex items-center justify-center rounded-lg bg-[#E9ECE5] text-[#737A74] ${asset.favicon ? "h-10 w-10" : "h-24 w-full sm:w-36"}`}
                    >
                      <ImagePlus size={asset.favicon ? 17 : 25} />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-0 sm:justify-start">
                    <label className="button-secondary inline-flex cursor-pointer items-center gap-2">
                      <ImagePlus size={15} />
                      Choose image
                      <input
                        className="sr-only"
                        type="file"
                        accept={
                          asset.accept ||
                          ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        }
                        onChange={(event) => chooseFile(asset.key, event)}
                      />
                    </label>
                    {preview && (
                      <button
                        type="button"
                        disabled={busyNow}
                        className="button-primary inline-flex items-center gap-2"
                        onClick={() => upload(asset)}
                      >
                        <Upload size={15} />
                        {busyNow ? "Saving…" : "Save image"}
                      </button>
                    )}
                    {currentUrl && !preview && (
                      <button
                        type="button"
                        disabled={busyNow}
                        className="inline-flex items-center gap-2 rounded-full border border-[#E3E5DF] px-4 py-2 text-sm text-[#8b4033] hover:bg-[#f8e8e3]"
                        onClick={() => remove(asset)}
                      >
                        <Trash2 size={15} />
                        {busyNow ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
                {preview && (
                  <p className="mt-2 text-xs text-[#737A74]">
                    Preview: {files[asset.key]?.name}. Select Save image to
                    apply it.
                  </p>
                )}
              </AdminPanel>
            );
          })}
        </div>
      )}
    </>
  );
}

export default AdminSiteSettings;
