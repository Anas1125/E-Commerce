import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
function AdminInventory() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState({});
  const [edit, setEdit] = useState(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const { notice, notify, clear } = useAdminNotice();
  const load = useCallback(async () => {
    try {
      const [i, p] = await Promise.all([
        api.get("/admin/inventory/"),
        api.get("/products/"),
      ]);
      setRows(i.data);
      setProducts(Object.fromEntries(p.data.map((x) => [x.id, x])));
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to load inventory.", "error");
    }
  }, [notify]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/admin/inventory/${edit.product_id}`, {
        quantity: Number(value),
      });
      notify("Inventory updated.");
      setEdit(null);
      load();
    } catch (e) {
      notify(
        e.response?.data?.detail || "Unable to update inventory.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Track on-hand, reserved, and available product quantities."
      />
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        {rows.length ? (
          <AdminTable
            headers={[
              "Product",
              "SKU / ID",
              "On hand",
              "Reserved",
              "Available",
              "Actions",
            ]}
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-medium">
                  {products[r.product_id]?.name || `Product ${r.product_id}`}
                </td>
                <td className="px-5 py-4 text-[#737A74]">#{r.product_id}</td>
                <td className="px-5 py-4">{r.quantity}</td>
                <td className="px-5 py-4">{r.reserved_quantity}</td>
                <td className="px-5 py-4">
                  <Badge>{r.available_quantity}</Badge>
                </td>
                <td className="px-5 py-4">
                  <button
                    aria-label={`Edit inventory for ${products[r.product_id]?.name || r.product_id}`}
                    className="rounded-lg p-2 hover:bg-[#DCE7DE]"
                    onClick={() => {
                      setEdit(r);
                      setValue(String(r.quantity));
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No inventory records.</AdminEmpty>
        )}
      </AdminPanel>
      {edit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-2xl bg-white p-6"
          >
            <h2 className="text-xl font-semibold">Update stock</h2>
            <p className="mt-2 text-sm text-[#737A74]">
              {products[edit.product_id]?.name || `Product ${edit.product_id}`}{" "}
              · {edit.reserved_quantity} reserved
            </p>
            <label className="mt-5 block text-sm font-medium">
              On-hand quantity
              <input
                required
                min={edit.reserved_quantity}
                type="number"
                className="field mt-2"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-[#737A74]">
              Quantity cannot be lower than reserved stock (
              {edit.reserved_quantity}).
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="button-primary">
                {busy ? "Saving…" : "Save quantity"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
export default AdminInventory;
