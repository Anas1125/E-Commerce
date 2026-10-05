import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import useAdminNotice from "../hooks/useAdminNotice";
import api from "../services/api";

import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

function AdminAdmins() {
  const [admins, setAdmins] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [passwordAdmin, setPasswordAdmin] = useState(null);
  const [detail, setDetail] = useState(null);

  const [creating, setCreating] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
  });

  const [newPassword, setNewPassword] = useState("");

  const { notice, notify, clear } = useAdminNotice();

  const load = useCallback(async () => {
    try {
      const response = await api.get("/admin/admins/");
      setAdmins(response.data);
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to load administrators.",
        "error",
      );
    }
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(load, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const createAdmin = async (event) => {
    event.preventDefault();

    try {
      setCreating(true);

      await api.post("/admin/admins/", form);

      notify("Admin account created successfully.");

      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        password: "",
      });

      setShowCreate(false);

      await load();
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to create admin account.",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (admin) => {
    try {
      await api.patch(
        `/admin/admins/${admin.id}/status`,
        {
          is_active: !admin.is_active,
        },
      );

      notify(
        admin.is_active
          ? "Admin deactivated."
          : "Admin activated.",
      );

      await load();
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to update admin status.",
        "error",
      );
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();

    try {
      setSavingPassword(true);

      await api.patch(
        `/admin/admins/${passwordAdmin.id}/password`,
        {
          password: newPassword,
        },
      );

      notify("Admin password updated successfully.");

      setPasswordAdmin(null);
      setNewPassword("");
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to update admin password.",
        "error",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAdmin = async (admin) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${admin.first_name}'s admin account? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/admin/admins/${admin.id}`);

      notify("Admin account deleted.");

      if (detail?.id === admin.id) {
        setDetail(null);
      }

      await load();
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to delete admin account.",
        "error",
      );
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Admin Management"
        description="Create and manage administrator accounts and access."
      />

      <AdminNotice
        notice={notice}
        onClose={clear}
      />

      <AdminPanel>
        <div className="flex items-center justify-end border-b border-[#E3E5DF] p-4">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#2878E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F68D0]"
          >
            <Plus size={17} />
            Add admin
          </button>
        </div>

        {admins.length ? (
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
                  <div>
                    {admin.first_name}{" "}
                    {admin.last_name || ""}
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-xs text-[#737A74]">
                    <ShieldCheck size={13} />
                    Administrator
                  </div>
                </td>

                <td className="px-5 py-4">
                  {admin.email}
                </td>

                <td className="px-5 py-4">
                  {admin.phone_number}
                </td>

                <td className="px-5 py-4">
                  {new Date(
                    admin.created_at,
                  ).toLocaleDateString("en-IN")}
                </td>

                <td className="px-5 py-4">
                  <Badge>
                    {admin.is_active
                      ? "active"
                      : "inactive"}
                  </Badge>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setDetail(admin)}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[#DCE7DE]"
                      aria-label={`View ${admin.first_name}`}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPasswordAdmin(admin);
                        setNewPassword("");
                      }}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 text-sm font-medium text-[#486B57]"
                    >
                      <KeyRound size={15} />
                      Password
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleStatus(admin)}
                      className="inline-flex h-9 cursor-pointer items-center text-sm font-medium text-[#486B57]"
                    >
                      {admin.is_active
                        ? "Deactivate"
                        : "Activate"}
                    </button>

                    {!admin.is_active && (
                      <button
                        type="button"
                        onClick={() => deleteAdmin(admin)}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 text-sm font-medium text-[#C62828]"
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>
            No administrator accounts found.
          </AdminEmpty>
        )}
      </AdminPanel>

      {/* CREATE ADMIN */}
      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Create admin
                </h2>

                <p className="mt-1 text-sm text-[#737A74]">
                  Create a new administrator account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="cursor-pointer text-sm text-[#486B57]"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={createAdmin}
              className="mt-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <input
                  className="field"
                  placeholder="First name"
                  value={form.first_name}
                  onChange={(event) =>
                    updateForm(
                      "first_name",
                      event.target.value,
                    )
                  }
                  required
                />

                <input
                  className="field"
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={(event) =>
                    updateForm(
                      "last_name",
                      event.target.value,
                    )
                  }
                />
              </div>

              <input
                className="field"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) =>
                  updateForm(
                    "email",
                    event.target.value,
                  )
                }
                required
              />

              <input
                className="field"
                placeholder="Phone number"
                value={form.phone_number}
                onChange={(event) =>
                  updateForm(
                    "phone_number",
                    event.target.value,
                  )
                }
                required
              />

              <input
                className="field"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(event) =>
                  updateForm(
                    "password",
                    event.target.value,
                  )
                }
                minLength={8}
                required
              />

              <button
                type="submit"
                disabled={creating}
                className="w-full cursor-pointer rounded-lg bg-[#2878E8] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating
                  ? "Creating..."
                  : "Create admin"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* CHANGE PASSWORD */}
      {passwordAdmin && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-semibold">
              Change password
            </h2>

            <p className="mt-2 text-sm text-[#737A74]">
              Change the password for{" "}
              <strong>
                {passwordAdmin.first_name}{" "}
                {passwordAdmin.last_name || ""}
              </strong>
              .
            </p>

            <form
              onSubmit={changePassword}
              className="mt-6 space-y-4"
            >
              <input
                className="field"
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                minLength={8}
                required
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordAdmin(null);
                    setNewPassword("");
                  }}
                  className="flex-1 cursor-pointer rounded-lg border border-[#D6D9D5] px-4 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex-1 cursor-pointer rounded-lg bg-[#2878E8] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingPassword
                    ? "Saving..."
                    : "Change password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ADMIN DETAILS */}
      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Administrator
              </h2>

              <button
                type="button"
                onClick={() => setDetail(null)}
                className="cursor-pointer text-sm text-[#486B57]"
              >
                Close
              </button>
            </div>

            <p className="mt-5 font-medium">
              {detail.first_name}{" "}
              {detail.last_name || ""}
            </p>

            <p className="mt-1 text-sm text-[#737A74]">
              {detail.email}
            </p>

            <p className="mt-1 text-sm text-[#737A74]">
              {detail.phone_number}
            </p>

            <p className="mt-4 text-sm">
              Joined{" "}
              {new Date(
                detail.created_at,
              ).toLocaleDateString("en-IN")}
            </p>

            <div className="mt-4">
              <Badge>
                {detail.is_active
                  ? "active"
                  : "inactive"}
              </Badge>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default AdminAdmins;