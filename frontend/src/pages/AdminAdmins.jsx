import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Eye,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import useAdminNotice from "../hooks/useAdminNotice";
import useAuth from "../context/useAuth";
import api from "../services/api";

import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  password: "",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  return error.response
    ? fallback
    : "Network problem. Check your connection and try again.";
}

async function fetchAdmins() {
  const response = await api.get("/admin/admins/");

  return Array.isArray(response.data) ? response.data : [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN");
}

function fullName(admin) {
  return `${admin.first_name || ""} ${admin.last_name || ""}`.trim();
}


function Modal({
  title,
  description,
  onClose,
  closeDisabled = false,
  widthClass = "sm:max-w-lg",
  children,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

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
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-2xl sm:p-6 ${widthClass}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>

            {description && (
              <div id={descId} className="mt-1 text-sm text-[#6A716B]">
                {description}
              </div>
            )}
          </div>

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

function Field({ id, label, hint, ...props }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-[#1F2521]"
      >
        {label}
      </label>

      <input id={id} className="field" {...props} />

      {hint && <p className="mt-1.5 text-xs text-[#6A716B]">{hint}</p>}
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

function RowActions({
  admin,
  isSelf,
  isLastActive,
  busy,
  variant,
  onView,
  onPassword,
  onToggle,
  onDelete,
}) {
  const isCard = variant === "card";

  const buttonClass = isCard
    ? "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#D6D9D5] px-3 text-sm font-medium transition hover:bg-[#F5F5F1] disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition hover:bg-[#F5F5F1] disabled:cursor-not-allowed disabled:opacity-50";

  const toggleBlocked = admin.is_active && (isSelf || isLastActive);
  const blockedReason = isSelf
    ? "You can't deactivate your own account."
    : "At least one active administrator is required.";

  const canDelete = !admin.is_active && !isSelf;
  const name = admin.first_name || "admin";

  return (
    <div
      className={
        isCard
          ? "mt-4 grid grid-cols-2 gap-2"
          : "flex flex-wrap items-center gap-1"
      }
    >
      <button
        type="button"
        onClick={() => onView(admin)}
        aria-label={`View ${name}`}
        className={`${buttonClass} text-[#486B57]`}
      >
        <Eye size={16} aria-hidden="true" />
        {isCard && <span>View</span>}
      </button>

      <button
        type="button"
        onClick={() => onPassword(admin)}
        disabled={busy}
        aria-label={`Change password for ${name}`}
        className={`${buttonClass} text-[#486B57]`}
      >
        <KeyRound size={15} aria-hidden="true" />
        <span>Password</span>
      </button>

      <button
        type="button"
        onClick={() => onToggle(admin)}
        disabled={busy || toggleBlocked}
        title={toggleBlocked ? blockedReason : undefined}
        aria-label={`${admin.is_active ? "Deactivate" : "Activate"} ${name}`}
        className={`${buttonClass} text-[#486B57]`}
      >
        {admin.is_active ? "Deactivate" : "Activate"}
      </button>

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(admin)}
          disabled={busy}
          aria-label={`Delete ${name}`}
          className={`${buttonClass} text-[#C62828]`}
        >
          <Trash2 size={15} aria-hidden="true" />
          <span>Delete</span>
        </button>
      )}

      {isCard && toggleBlocked && (
        <p className="col-span-2 text-xs text-[#6A716B]">{blockedReason}</p>
      )}
    </div>
  );
}


function AdminAdmins() {
  const { user } = useAuth();
  const currentId = user?.id;

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [passwordAdminId, setPasswordAdminId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const [creating, setCreating] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { notice, notify, clear } = useAdminNotice();

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;

    try {
      const list = await fetchAdmins();

      if (id !== requestId.current) return;

      setAdmins(list);
      setLoadError("");
    } catch (error) {
      if (id !== requestId.current) return;

      setLoadError(getErrorMessage(error, "Unable to load administrators."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = ++requestId.current;

    fetchAdmins()
      .then((list) => {
        if (id === requestId.current) setAdmins(list);
      })
      .catch((error) => {
        if (id === requestId.current) {
          setLoadError(getErrorMessage(error, "Unable to load administrators."));
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

  const detail = admins.find((admin) => admin.id === detailId) || null;
  const passwordAdmin =
    admins.find((admin) => admin.id === passwordAdminId) || null;

  const activeCount = admins.filter((admin) => admin.is_active).length;

  const isSelf = (admin) =>
    currentId != null && String(admin.id) === String(currentId);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setCreateError("");
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setCreateError("");
  };

  const openPassword = (admin) => {
    setPasswordAdminId(admin.id);
    setNewPassword("");
    setPasswordError("");
  };

  const closePassword = () => {
    setPasswordAdminId(null);
    setNewPassword("");
    setPasswordError("");
  };

  const createAdmin = async (event) => {
    event.preventDefault();

    if (creating) return;

    setCreateError("");
    setCreating(true);

    try {
      await api.post("/admin/admins/", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number.trim(),
        password: form.password,
      });

      closeCreate();
      notify("Admin account created successfully.");

      await load();
    } catch (error) {
      setCreateError(getErrorMessage(error, "Unable to create admin account."));
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (admin) => {
    if (busyId !== null) return;

    setBusyId(admin.id);

    try {
      await api.patch(`/admin/admins/${admin.id}/status`, {
        is_active: !admin.is_active,
      });

      notify(admin.is_active ? "Admin deactivated." : "Admin activated.");

      await load();
    } catch (error) {
      notify(getErrorMessage(error, "Unable to update admin status."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();

    if (savingPassword || !passwordAdmin) return;

    setPasswordError("");
    setSavingPassword(true);

    try {
      await api.patch(`/admin/admins/${passwordAdmin.id}/password`, {
        password: newPassword,
      });

      closePassword();
      notify("Admin password updated successfully.");
    } catch (error) {
      setPasswordError(
        getErrorMessage(error, "Unable to update admin password."),
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAdmin = async (admin) => {
    if (busyId !== null) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${admin.first_name}'s admin account? This cannot be undone.`,
    );

    if (!confirmed) return;

    setBusyId(admin.id);

    try {
      await api.delete(`/admin/admins/${admin.id}`);

      notify("Admin account deleted.");

      await load();
    } catch (error) {
      notify(getErrorMessage(error, "Unable to delete admin account."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const actionProps = (admin) => ({
    admin,
    isSelf: isSelf(admin),
    isLastActive: admin.is_active && activeCount <= 1,
    busy: busyId !== null,
    onView: (item) => setDetailId(item.id),
    onPassword: openPassword,
    onToggle: toggleStatus,
    onDelete: deleteAdmin,
  });

  let content;

  if (loading) {
    content = (
      <div
        role="status"
        className="px-5 py-12 text-center text-sm text-[#6A716B]"
      >
        Loading administrators…
      </div>
    );
  } else if (loadError && !admins.length) {
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
  } else if (!admins.length) {
    content = <AdminEmpty>No administrator accounts found.</AdminEmpty>;
  } else {
    content = (
      <>
        {loadError && (
          <div
            role="alert"
            className="flex flex-col gap-2 border-b border-[#E3E5DF] bg-[#FFF8E1] px-4 py-3 text-sm text-[#6A4B00] sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              Couldn't refresh the list. Showing the last loaded data.
            </span>

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
          <AdminTable
            headers={[
              "Administrator",
              "Email",
              "Phone",
              "Joined",
              "Status",
              "Actions",
            ]}
          >
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td className="px-5 py-4 font-medium">
                  <div className="flex items-center gap-2">
                    {fullName(admin)}

                    {isSelf(admin) && (
                      <span className="rounded-full bg-[#DCE7DE] px-2 py-0.5 text-[11px] font-semibold text-[#385744]">
                        You
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-xs text-[#6A716B]">
                    <ShieldCheck size={13} aria-hidden="true" />
                    Administrator
                  </div>
                </td>

                <td className="px-5 py-4">{admin.email}</td>

                <td className="px-5 py-4">{admin.phone_number || "—"}</td>

                <td className="px-5 py-4">{formatDate(admin.created_at)}</td>

                <td className="px-5 py-4">
                  <Badge>{admin.is_active ? "active" : "inactive"}</Badge>
                </td>

                <td className="px-5 py-4">
                  <RowActions {...actionProps(admin)} variant="table" />
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>

        {/* MOBILE CARDS */}
        <ul className="divide-y divide-[#E3E5DF] md:hidden">
          {admins.map((admin) => (
            <li key={admin.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="break-words">{fullName(admin)}</span>

                    {isSelf(admin) && (
                      <span className="rounded-full bg-[#DCE7DE] px-2 py-0.5 text-[11px] font-semibold text-[#385744]">
                        You
                      </span>
                    )}
                  </p>

                  <p className="mt-1 break-all text-sm text-[#6A716B]">
                    {admin.email}
                  </p>
                </div>

                <Badge>{admin.is_active ? "active" : "inactive"}</Badge>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[#6A716B]">Phone</dt>
                  <dd className="mt-0.5 break-all">
                    {admin.phone_number || "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6A716B]">Joined</dt>
                  <dd className="mt-0.5">{formatDate(admin.created_at)}</dd>
                </div>
              </dl>

              <RowActions {...actionProps(admin)} variant="card" />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Admin Management"
        description="Create and manage administrator accounts and access."
      />

      <AdminNotice notice={notice} onClose={clear} />

      <AdminPanel>
        <div className="flex items-center border-b border-[#E3E5DF] p-4 sm:justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#2878E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F68D0] sm:w-auto"
          >
            <Plus size={17} aria-hidden="true" />
            Add admin
          </button>
        </div>

        {content}
      </AdminPanel>

      {/* CREATE ADMIN */}
      {showCreate && (
        <Modal
          title="Create admin"
          description="Create a new administrator account."
          onClose={closeCreate}
          closeDisabled={creating}
        >
          <form onSubmit={createAdmin} className="space-y-4">
            <FormError message={createError} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="admin-first-name"
                label="First name"
                autoFocus
                autoComplete="off"
                value={form.first_name}
                onChange={(event) => updateForm("first_name", event.target.value)}
                required
              />

              <Field
                id="admin-last-name"
                label="Last name"
                autoComplete="off"
                value={form.last_name}
                onChange={(event) => updateForm("last_name", event.target.value)}
              />
            </div>

            <Field
              id="admin-email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              required
            />

            <Field
              id="admin-phone"
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.phone_number}
              onChange={(event) => updateForm("phone_number", event.target.value)}
              required
            />

            <Field
              id="admin-password"
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="12–128 characters required."
              value={form.password}
              onChange={(event) => updateForm("password", event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />

            <button
              type="submit"
              disabled={creating}
              className="min-h-11 w-full cursor-pointer rounded-lg bg-[#2878E8] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create admin"}
            </button>
          </form>
        </Modal>
      )}

      {/* CHANGE PASSWORD */}
      {passwordAdmin && (
        <Modal
          title="Change password"
          description={
            <>
              Change the password for <strong>{fullName(passwordAdmin)}</strong>.
            </>
          }
          onClose={closePassword}
          closeDisabled={savingPassword}
          widthClass="sm:max-w-md"
        >
          <form onSubmit={changePassword} className="space-y-4">
            <FormError message={passwordError} />

            <Field
              id="admin-new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              autoFocus
              hint="At least 8 characters."
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closePassword}
                disabled={savingPassword}
                className="min-h-11 flex-1 cursor-pointer rounded-lg border border-[#D6D9D5] px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingPassword}
                className="min-h-11 flex-1 cursor-pointer rounded-lg bg-[#2878E8] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPassword ? "Saving..." : "Change password"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ADMIN DETAILS */}
      {detail && (
        <Modal
          title="Administrator"
          onClose={() => setDetailId(null)}
          widthClass="sm:max-w-md"
        >
          <p className="font-medium">{fullName(detail)}</p>

          <p className="mt-1 break-all text-sm text-[#6A716B]">{detail.email}</p>

          <p className="mt-1 text-sm text-[#6A716B]">
            {detail.phone_number || "—"}
          </p>

          <p className="mt-4 text-sm">Joined {formatDate(detail.created_at)}</p>

          <div className="mt-4">
            <Badge>{detail.is_active ? "active" : "inactive"}</Badge>
          </div>
        </Modal>
      )}
    </>
  );
}

export default AdminAdmins;