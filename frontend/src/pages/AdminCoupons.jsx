import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";

import api from "../services/api";
import useAdminNotice from "../hooks/useAdminNotice";

import {
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

const localDate = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000);

  return new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
};

const initialForm = {
  code: "",
  name: "",
  discount_type: "percentage",
  value: "",
  minimum_order_amount: "0",
  maximum_discount: "",
  usage_limit: "",
  per_user_limit: "1",
  first_order_only: false,
  start_date: localDate(0),
  end_date: localDate(7),
  is_active: true,
};

function AdminCoupons() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);

  const { notice, notify, clear } = useAdminNotice();

  const load = useCallback(async () => {
    try {
      const response = await api.get("/coupons/");
      setRows(response.data);
    } catch (e) {
      notify(
        e.response?.data?.detail ||
          "Unable to load coupons.",
        "error"
      );
    }
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(load, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setOpen(true);
  };

  const openEdit = (coupon) => {
    setEditing(coupon);

    setForm({
      code: coupon.code || "",
      name: coupon.name || "",
      discount_type: coupon.discount_type || "percentage",
      value: coupon.value ?? "",
      minimum_order_amount:
        coupon.minimum_order_amount ?? "0",
      maximum_discount:
        coupon.maximum_discount ?? "",
      usage_limit:
        coupon.usage_limit ?? "",
      per_user_limit:
        coupon.per_user_limit ?? "1",
      first_order_only:
        Boolean(coupon.first_order_only),
      start_date: toLocalInput(coupon.start_date),
      end_date: toLocalInput(coupon.end_date),
      is_active:
        coupon.is_active !== false,
    });

    setOpen(true);
  };

  const closeModal = () => {
    if (busy) return;

    setOpen(false);
    setEditing(null);
    setForm(initialForm);
  };

  const save = async (event) => {
    event.preventDefault();

    setBusy(true);

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      discount_type: form.discount_type,
      value: Number(form.value),
      minimum_order_amount:
        Number(form.minimum_order_amount || 0),
      maximum_discount:
        form.discount_type === "percentage" &&
        form.maximum_discount !== ""
          ? Number(form.maximum_discount)
          : null,
      usage_limit:
        form.usage_limit !== ""
          ? Number(form.usage_limit)
          : null,
      per_user_limit:
        Number(form.per_user_limit || 1),
      first_order_only:
        Boolean(form.first_order_only),
      start_date: new Date(
        form.start_date
      ).toISOString(),
      end_date: new Date(
        form.end_date
      ).toISOString(),
      is_active:
        Boolean(form.is_active),
    };

    try {
      if (editing) {
        await api.put(
          `/coupons/${editing.id}`,
          payload
        );

        notify("Coupon updated.");
      } else {
        await api.post(
          "/coupons/",
          payload
        );

        notify("Coupon created.");
      }

      closeModal();
      load();
    } catch (e) {
      notify(
        e.response?.data?.detail ||
          "Unable to save coupon.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (coupon) => {
    try {
      await api.patch(
        `/coupons/${coupon.id}/status`,
        null,
        {
          params: {
            is_active: !coupon.is_active,
          },
        }
      );

      notify(
        coupon.is_active
          ? "Coupon deactivated."
          : "Coupon activated."
      );

      load();
    } catch (e) {
      notify(
        e.response?.data?.detail ||
          "Unable to update coupon status.",
        "error"
      );
    }
  };

  const remove = async (coupon) => {
    const confirmed = window.confirm(
      `Delete coupon "${coupon.code}"?`
    );

    if (!confirmed) return;

    try {
      await api.delete(
        `/coupons/${coupon.id}`
      );

      notify("Coupon deleted.");
      load();
    } catch (e) {
      notify(
        e.response?.data?.detail ||
          "Unable to delete coupon.",
        "error"
      );
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Coupons"
        description="Manage customer coupon codes, eligibility and usage rules."
      >
        <button
          className="button-primary inline-flex items-center gap-2 cursor-pointer"
          onClick={openCreate}
        >
          <Plus size={16} />
          Create coupon
        </button>
      </AdminPageHeader>

      <AdminNotice
        notice={notice}
        onClose={clear}
      />

      <AdminPanel>
        {rows.length ? (
          <AdminTable
            headers={[
              "Coupon",
              "Discount",
              "Minimum order",
              "Usage",
              "Eligibility",
              "Validity",
              "State",
              "Actions",
            ]}
          >
            {rows.map((coupon) => (
              <tr key={coupon.id}>
                <td className="px-5 py-4">
                  <div className="font-semibold">
                    {coupon.code}
                  </div>

                  <div className="mt-1 text-xs text-[#737A74]">
                    {coupon.name}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className="font-medium">
                    {coupon.discount_type ===
                    "percentage"
                      ? `${coupon.value}%`
                      : `₹${Number(
                          coupon.value
                        ).toLocaleString(
                          "en-IN"
                        )}`}
                  </span>

                  {coupon.maximum_discount &&
                    coupon.discount_type ===
                      "percentage" && (
                      <div className="mt-1 text-xs text-[#737A74]">
                        Max ₹
                        {Number(
                          coupon.maximum_discount
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </div>
                    )}
                </td>

                <td className="px-5 py-4">
                  ₹
                  {Number(
                    coupon.minimum_order_amount
                  ).toLocaleString("en-IN")}
                </td>

                <td className="px-5 py-4">
                  {coupon.used_count}
                  {" / "}
                  {coupon.usage_limit ??
                    "∞"}
                </td>

                <td className="px-5 py-4">
                  <div className="space-y-1 text-xs">
                    {coupon.first_order_only && (
                      <Badge>
                        First order
                      </Badge>
                    )}

                    <div>
                      {coupon.per_user_limit} per
                      user
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4 text-xs">
                  <div>
                    {formatDate(
                      coupon.start_date
                    )}
                  </div>
                  <div className="mt-1 text-[#737A74]">
                    to{" "}
                    {formatDate(
                      coupon.end_date
                    )}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <Badge>
                    {coupon.is_active
                      ? "active"
                      : "inactive"}
                  </Badge>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit coupon"
                      onClick={() =>
                        openEdit(coupon)
                      }
                      className="rounded-lg p-2 text-[#486B57] hover:bg-[#F5F5F1] cursor-pointer"
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      type="button"
                      title={
                        coupon.is_active
                          ? "Deactivate coupon"
                          : "Activate coupon"
                      }
                      onClick={() =>
                        toggleStatus(coupon)
                      }
                      className="rounded-lg p-2 text-[#486B57] hover:bg-[#F5F5F1] cursor-pointer"
                    >
                      <Power size={16} />
                    </button>

                    <button
                      type="button"
                      title="Delete coupon"
                      onClick={() =>
                        remove(coupon)
                      }
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>
            No coupons configured.
          </AdminEmpty>
        )}
      </AdminPanel>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {editing
                    ? "Edit coupon"
                    : "Create coupon"}
                </h2>

                <p className="mt-1 text-sm text-[#737A74]">
                  Configure discount and eligibility
                  rules.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-[#F5F5F1]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminField label="Coupon code">
                <input
                  required
                  minLength={3}
                  maxLength={50}
                  className="field mt-2 uppercase"
                  value={form.code}
                  onChange={(e) =>
                    updateForm(
                      "code",
                      e.target.value
                    )
                  }
                  placeholder="WELCOME10"
                />
              </AdminField>

              <AdminField label="Coupon name">
                <input
                  required
                  maxLength={150}
                  className="field mt-2"
                  value={form.name}
                  onChange={(e) =>
                    updateForm(
                      "name",
                      e.target.value
                    )
                  }
                  placeholder="Welcome Discount"
                />
              </AdminField>

              <AdminField label="Discount type">
                <select
                  className="field mt-2"
                  value={form.discount_type}
                  onChange={(e) =>
                    updateForm(
                      "discount_type",
                      e.target.value
                    )
                  }
                >
                  <option value="percentage">
                    Percentage
                  </option>
                  <option value="fixed">
                    Fixed amount
                  </option>
                </select>
              </AdminField>

              <AdminField
                label={
                  form.discount_type ===
                  "percentage"
                    ? "Discount percentage"
                    : "Discount amount (₹)"
                }
              >
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={
                    form.discount_type ===
                    "percentage"
                      ? 100
                      : undefined
                  }
                  className="field mt-2"
                  value={form.value}
                  onChange={(e) =>
                    updateForm(
                      "value",
                      e.target.value
                    )
                  }
                />
              </AdminField>

              <AdminField label="Minimum order amount (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="field mt-2"
                  value={
                    form.minimum_order_amount
                  }
                  onChange={(e) =>
                    updateForm(
                      "minimum_order_amount",
                      e.target.value
                    )
                  }
                />
              </AdminField>

              <AdminField label="Maximum discount (₹)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  disabled={
                    form.discount_type !==
                    "percentage"
                  }
                  className="field mt-2 disabled:cursor-not-allowed disabled:bg-[#F5F5F1]"
                  value={
                    form.maximum_discount
                  }
                  onChange={(e) =>
                    updateForm(
                      "maximum_discount",
                      e.target.value
                    )
                  }
                  placeholder={
                    form.discount_type ===
                    "percentage"
                      ? "Optional"
                      : "Percentage only"
                  }
                />
              </AdminField>

              <AdminField label="Usage limit">
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="field mt-2"
                  value={form.usage_limit}
                  onChange={(e) =>
                    updateForm(
                      "usage_limit",
                      e.target.value
                    )
                  }
                  placeholder="Unlimited"
                />
              </AdminField>

              <AdminField label="Per-user limit">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  className="field mt-2"
                  value={
                    form.per_user_limit
                  }
                  onChange={(e) =>
                    updateForm(
                      "per_user_limit",
                      e.target.value
                    )
                  }
                />
              </AdminField>

              <AdminField label="Starts">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.start_date}
                  onChange={(e) =>
                    updateForm(
                      "start_date",
                      e.target.value
                    )
                  }
                />
              </AdminField>

              <AdminField label="Ends">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.end_date}
                  onChange={(e) =>
                    updateForm(
                      "end_date",
                      e.target.value
                    )
                  }
                />
              </AdminField>

              <label className="flex items-center gap-3 rounded-xl border border-[#E3E5DF] p-4 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={
                    form.first_order_only
                  }
                  onChange={(e) =>
                    updateForm(
                      "first_order_only",
                      e.target.checked
                    )
                  }
                />

                <span>
                  <span className="block font-medium">
                    First order only
                  </span>

                  <span className="mt-1 block text-xs text-[#737A74]">
                    Only customers who have never
                    placed an order can use this
                    coupon.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-[#E3E5DF] p-4 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    updateForm(
                      "is_active",
                      e.target.checked
                    )
                  }
                />

                <span>
                  <span className="block font-medium">
                    Active
                  </span>

                  <span className="mt-1 block text-xs text-[#737A74]">
                    Customers can use the coupon
                    only when it is active and
                    within its validity dates.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="button-secondary cursor-pointer"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                disabled={busy}
                className="button-primary inline-flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />

                {busy
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create coupon"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function toLocalInput(value) {
  const date = new Date(value);

  return new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
}

export default AdminCoupons;