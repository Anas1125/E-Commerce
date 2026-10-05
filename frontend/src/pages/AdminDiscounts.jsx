import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
const localDate = (offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function AdminDiscounts() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    discount_type: "percentage",
    value: "",
    product_id: "",
    start_date: localDate(0),
    end_date: localDate(7),
    is_active: true,
  });
  const blank = {
    name: "",
    discount_type: "percentage",
    value: "",
    product_id: "",
    start_date: "",
    end_date: "",
    is_active: true,
  };
  const [busy, setBusy] = useState(false);
  const { notice, notify, clear } = useAdminNotice();
  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        api.get("/discounts/"),
        api.get("/products/"),
      ]);
      setRows(d.data);
      setProducts(p.data);
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to load discounts.", "error");
    }
  }, [notify]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      discount_type: form.discount_type,
      value: Number(form.value),
      product_id: form.product_id ? Number(form.product_id) : null,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      is_active: form.is_active,
    };
    try {
      await api.post("/discounts/", payload);
      setOpen(false);
      setForm({
        ...blank,
      });
      notify("Discount created.");

      load();
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to create discount.", "error");
    } finally {
      setBusy(false);
    }
  };
  const toggleDiscount = async (discount) => {
    try {
      await api.patch(
        `/discounts/${discount.id}/status`,
        null,
        {
          params: {
            is_active: !discount.is_active,
          },
        },
      );

      notify(
        discount.is_active
          ? "Discount disabled."
          : "Discount enabled.",
      );

      load();
    } catch (e) {
      notify(
        e.response?.data?.detail ||
          "Unable to update discount.",
        "error",
      );
    }
  };

  const deleteDiscount = async (discount) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${discount.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/discounts/${discount.id}`,
      );

      notify("Discount deleted.");

      load();
    } catch (e) {
      notify(
        e.response?.data?.detail ||
          "Unable to delete discount.",
        "error",
      );
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Discounts"
        description="Manage active product or storewide offers."
      >
        <button
          type="button"
          className="button-primary inline-flex gap-2 cursor-pointer"
          onClick={() => {
            setForm({
              ...blank,
            });

            setOpen(true);
          }}
        >
          <Plus size={16} />
          Create discount
        </button>
      </AdminPageHeader>
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        {rows.length ? (
          <AdminTable
            headers={[
              "Offer",
              "Type",
              "Value",
              "Applies to",
              "Start",
              "End",
              "State",
              "Action",
            ]}
          >
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-4 font-medium">{d.name}</td>
                <td className="px-5 py-4 capitalize">{d.discount_type}</td>
                <td className="px-5 py-4">
                  {d.discount_type === "percentage"
                    ? `${d.value}%`
                    : `₹${Number(d.value).toLocaleString("en-IN")}`}
                </td>
                <td className="px-5 py-4">
                  {d.product_id
                    ? products.find((p) => p.id === d.product_id)?.name ||
                      `Product ${d.product_id}`
                    : "All products"}
                </td>
                <td className="px-5 py-4">
                  {new Date(d.start_date).toLocaleDateString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  {new Date(d.end_date).toLocaleDateString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  <Badge>{d.is_active ? "active" : "inactive"}</Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleDiscount(d)}
                      className="cursor-pointer text-sm font-semibold text-[#486B57] hover:text-[#2F513F]"
                    >
                      {d.is_active ? "Disable" : "Enable"}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDiscount(d)}
                      className="cursor-pointer text-sm font-semibold text-[#9A5547] hover:text-[#7F4035]"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No discounts configured.</AdminEmpty>
        )}
      </AdminPanel>
      <p className="mt-4 text-xs text-[#737A74]">
        Discounts can be enabled or disabled at any time. Start and
        end dates still control when an active discount is valid.
      </p>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold ">Create discount</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-[#486B57] cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AdminField label="Offer name">
                <input
                  required
                  maxLength={150}
                  className="field mt-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </AdminField>
              <AdminField label="Discount type">
                <select
                  className="field mt-2"
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm({ ...form, discount_type: e.target.value })
                  }
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </AdminField>
              <AdminField
                label={
                  form.discount_type === "percentage"
                    ? "Percentage (max 100)"
                    : "Amount (₹)"
                }
              >
                <input
                  required
                  min="0.01"
                  max={form.discount_type === "percentage" ? 100 : undefined}
                  step="0.01"
                  type="number"
                  className="field mt-2"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </AdminField>
              <AdminField label="Product (optional)">
                <select
                  className="field mt-2"
                  value={form.product_id}
                  onChange={(e) =>
                    setForm({ ...form, product_id: e.target.value })
                  }
                >
                  <option value="">All products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Starts">
                <input
                  required
                  type="datetime-local"
                  className="field mt-2"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
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
                    setForm({ ...form, end_date: e.target.value })
                  }
                />
              </AdminField>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="button-secondary cursor-pointer"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button disabled={busy} className="button-primary cursor-pointer">
                {busy ? "Creating…" : "Create discount"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
export default AdminDiscounts;
