import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import api from "../services/api";
import useAuth from "../context/useAuth";
import { EmptyState, LoadingState, PageIntro } from "../components/Storefront";
const blank = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  is_default: false,
};
function Addresses() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const r = await api.get("/addresses/");
      setItems(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load addresses.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);
  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const start = (a) => {
    setEditing(a?.id || null);
    setForm(a ? { ...a, address_line2: a.address_line2 || "" } : blank);
    setOpen(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = { ...form, address_line2: form.address_line2 || null };
    try {
      if (editing) await api.put(`/addresses/${editing}`, payload);
      else await api.post("/addresses/", payload);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save address.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this saved address?")) return;
    try {
      await api.delete(`/addresses/${id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to delete address.");
    }
  };
  const controls = [
    ["address_line1", "Address line 1"],
    ["address_line2", "Address line 2 (optional)"],
    ["city", "City"],
    ["state", "State"],
    ["postal_code", "Postal code"],
    ["country", "Country"],
  ];
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <PageIntro
        eyebrow="Delivery details"
        title="Saved Addresses"
        description="Manage the places your TerraLens orders can reach."
      >
        <button
          className="button-primary inline-flex gap-2"
          onClick={() => start(null)}
        >
          <Plus size={16} />
          Add address
        </button>
      </PageIntro>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#f8e8e3] px-4 py-3 text-sm text-[#8b4033]"
        >
          {error}
        </p>
      )}
      {loading ? (
        <LoadingState />
      ) : !isAuthenticated ? (
        <EmptyState
          title="Sign in to manage addresses"
          text="Your saved delivery details are private to your account."
          action="Sign in"
          to="/login"
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No saved addresses"
          text="Add a delivery address for a quicker checkout."
          action="Shop the collection"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((a) => (
            <article
              key={a.id}
              className="rounded-2xl border border-[#E3E5DF] bg-white p-6"
            >
              <div className="flex items-start justify-between">
                <MapPin size={19} className="text-[#486B57]" />
                {a.is_default && (
                  <span className="rounded-full bg-[#DCE7DE] px-3 py-1 text-xs font-medium text-[#486B57]">
                    Default
                  </span>
                )}
              </div>
              <address className="mt-4 not-italic text-sm leading-6">
                {a.address_line1}
                {a.address_line2 && (
                  <>
                    <br />
                    {a.address_line2}
                  </>
                )}
                <br />
                {a.city}, {a.state} {a.postal_code}
                <br />
                {a.country}
              </address>
              <div className="mt-5 flex gap-4">
                <button
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#486B57]"
                  onClick={() => start(a)}
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  className="inline-flex items-center gap-2 text-sm text-[#8b4033]"
                  onClick={() => remove(a.id)}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1f252180] p-4"
          role="presentation"
        >
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
            aria-labelledby="address-title"
          >
            <h2 id="address-title" className="text-xl font-semibold">
              {editing ? "Edit address" : "Add address"}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {controls.map(([name, label]) => (
                <label key={name} className="text-sm font-medium">
                  {label}
                  <input
                    className="field mt-2"
                    required={!name.endsWith("2")}
                    value={form[name] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [name]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) =>
                    setForm({ ...form, is_default: e.target.checked })
                  }
                />
                Set as default
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button disabled={busy} className="button-primary">
                {busy ? "Saving…" : "Save address"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
export default Addresses;
