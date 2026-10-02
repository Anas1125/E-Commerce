import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  Check,
  Edit3,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import useAuth from "../context/useAuth";

function Addresses() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [formOpen, setFormOpen] =
    useState(false);

  const [editing, setEditing] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [form, setForm] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    is_default: false,
  });

  const load = useCallback(
    async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setError("");

        const response =
          await api.get("/addresses/");

        setAddresses(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.detail ||
            "Unable to load your addresses.",
        );
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    const timer = setTimeout(
      load,
      0,
    );

    return () =>
      clearTimeout(timer);
  }, [load]);

  const resetForm = () => {
    setForm({
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "India",
      is_default:
        addresses.length === 0,
    });

    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (address) => {
    setEditing(address);

    setForm({
      address_line1:
        address.address_line1 ||
        "",
      address_line2:
        address.address_line2 ||
        "",
      city: address.city || "",
      state: address.state || "",
      postal_code:
        address.postal_code ||
        "",
      country:
        address.country ||
        "India",
      is_default:
        Boolean(address.is_default),
    });

    setFormOpen(true);
  };

  const closeForm = () => {
    if (busy) return;

    setFormOpen(false);
    setEditing(null);
  };

  const change = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setBusy(true);

    const payload = {
      address_line1:
        form.address_line1.trim(),
      address_line2:
        form.address_line2.trim() ||
        null,
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code:
        form.postal_code.trim(),
      country:
        form.country.trim() ||
        "India",
      is_default:
        form.is_default,
    };

    try {
      if (editing) {
        await api.put(
          `/addresses/${editing.id}`,
          payload,
        );
      } else {
        await api.post(
          "/addresses/",
          payload,
        );
      }

      setFormOpen(false);
      setEditing(null);

      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.detail ||
          "Unable to save this address.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this address?",
      );

    if (!confirmed) return;

    setError("");

    try {
      await api.delete(
        `/addresses/${id}`,
      );

      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.detail ||
          "Unable to delete this address.",
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="border border-[#E0E0E0] bg-white px-6 py-16 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
              <MapPin size={28} />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#212121]">
              Sign in to manage your addresses
            </h1>

            <p className="mt-2 text-sm text-[#878787]">
              Save delivery addresses for faster checkout.
            </p>

            <Link
              to="/login"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
            >
              Sign in
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="border border-[#E0E0E0] bg-white px-6 py-16 text-center">
            <p className="text-sm text-[#878787]">
              Loading your addresses...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-7 pb-14 sm:px-6 sm:py-9">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
              Delivery Details
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#212121] sm:text-3xl">
              Saved Addresses
            </h1>

            <p className="mt-1 text-sm text-[#878787]">
              Manage your delivery addresses for faster checkout.
            </p>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
          >
            <Plus size={17} />
            Add address
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="mb-5 border border-[#FFCDD2] bg-[#FFEBEE] px-5 py-4 text-sm text-[#D32F2F]"
          >
            {error}
          </div>
        )}

        {/* ADDRESS LIST */}
        {addresses.length === 0 ? (
          <div className="border border-[#E0E0E0] bg-white">

            <div className="px-6 py-16 text-center sm:py-20">

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6] text-[#2874F0]">
                <MapPin size={32} />
              </div>

              <h2 className="mt-6 text-xl font-bold text-[#212121]">
                No saved addresses
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-[#878787]">
                Add a delivery address to make your checkout faster.
              </p>

              <button
                type="button"
                onClick={openAdd}
                className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
              >
                <Plus size={17} />
                Add your first address
              </button>

            </div>
          </div>
        ) : (
          <>

            {/* SAVED ADDRESS CARD */}
            <section className="border border-[#E0E0E0] bg-white">

              <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-[#212121]">
                    Delivery Addresses
                  </h2>

                  <p className="mt-1 text-xs text-[#878787]">
                    {addresses.length}{" "}
                    {addresses.length === 1
                      ? "saved address"
                      : "saved addresses"}
                  </p>
                </div>

                <MapPin
                  size={19}
                  className="text-[#2874F0]"
                />
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">

                {addresses.map(
                  (address) => (
                    <article
                      key={address.id}
                      className={`border bg-white transition ${
                        address.is_default
                          ? "border-[#2874F0]"
                          : "border-[#E0E0E0] hover:border-[#BDBDBD]"
                      }`}
                    >

                      {/* ADDRESS HEADER */}
                      <div className="flex items-start justify-between border-b border-[#E0E0E0] px-4 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                            <MapPin size={17} />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-[#212121]">
                              Delivery Address
                            </p>

                            <p className="mt-0.5 text-xs text-[#878787]">
                              Saved address
                            </p>
                          </div>

                        </div>

                        {address.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-3 py-1 text-[11px] font-bold text-[#388E3C]">
                            <Check size={12} />
                            Default
                          </span>
                        )}
                      </div>

                      {/* ADDRESS */}
                      <div className="px-4 py-5">

                        <p className="font-bold text-[#212121]">
                          {address.address_line1}
                        </p>

                        {address.address_line2 && (
                          <p className="mt-1 text-sm text-[#555]">
                            {address.address_line2}
                          </p>
                        )}

                        <p className="mt-2 text-sm leading-6 text-[#555]">
                          {address.city},{" "}
                          {address.state}{" "}
                          {address.postal_code}
                        </p>

                        <p className="mt-1 text-sm text-[#878787]">
                          {address.country}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center gap-5 border-t border-[#E0E0E0] px-4 py-3">

                        <button
                          type="button"
                          onClick={() =>
                            openEdit(address)
                          }
                          className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#2874F0] hover:text-[#1f65d6]"
                        >
                          <Edit3 size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            remove(address.id)
                          }
                          className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#D32F2F] hover:text-[#B71C1C]"
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>

                      </div>
                    </article>
                  ),
                )}

              </div>
            </section>

            {/* CONTINUE CHECKOUT */}
            <section className="mt-5 border border-[#E0E0E0] bg-white">

              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#388E3C]">
                    <Check size={19} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#212121]">
                      Ready to checkout?
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-[#878787]">
                      Choose your delivery address during checkout and
                      review your order before placing it.
                    </p>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/checkout")
                  }
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] sm:w-auto"
                >
                  Continue to Checkout
                  <ArrowRight size={17} />
                </button>

              </div>
            </section>

          </>
        )}

        {/* INFO */}
        <div className="mt-5 border border-[#E0E0E0] bg-white px-5 py-4">

          <div className="flex items-start gap-3">

            <MapPin
              size={18}
              className="mt-0.5 shrink-0 text-[#2874F0]"
            />

            <div>
              <p className="text-sm font-bold text-[#212121]">
                Address & order history
              </p>

              <p className="mt-1 text-xs leading-5 text-[#878787]">
                Addresses used for previous orders may not be
                removable because they are linked to your order
                history.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* ADD / EDIT MODAL */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[#E0E0E0] bg-white shadow-2xl">

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-[#212121]">
                  {editing
                    ? "Edit Address"
                    : "Add New Address"}
                </h2>

                <p className="mt-1 text-xs text-[#878787]">
                  Enter your delivery details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={busy}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#555] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed"
              >
                <X size={19} />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={submit}
              className="p-5"
            >

              <div className="grid gap-5 sm:grid-cols-2">

                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold text-[#212121]">
                    Address line 1
                  </span>

                  <input
                    required
                    name="address_line1"
                    value={
                      form.address_line1
                    }
                    onChange={change}
                    placeholder="House / flat / building"
                    className="mt-2 h-11 w-full rounded-md border border-[#D0D0D0] px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold text-[#212121]">
                    Address line 2
                  </span>

                  <input
                    name="address_line2"
                    value={
                      form.address_line2
                    }
                    onChange={change}
                    placeholder="Street, area, landmark (optional)"
                    className="mt-2 h-11 w-full rounded-md border border-[#D0D0D0] px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-[#212121]">
                    City
                  </span>

                  <input
                    required
                    name="city"
                    value={form.city}
                    onChange={change}
                    className="mt-2 h-11 w-full rounded-md border border-[#D0D0D0] px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-[#212121]">
                    State
                  </span>

                  <input
                    required
                    name="state"
                    value={form.state}
                    onChange={change}
                    className="mt-2 h-11 w-full rounded-md border border-[#D0D0D0] px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-[#212121]">
                    Postal code
                  </span>

                  <input
                    required
                    name="postal_code"
                    value={
                      form.postal_code
                    }
                    onChange={change}
                    className="mt-2 h-11 w-full rounded-md border border-[#D0D0D0] px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-[#212121]">
                    Country
                  </span>

                  <input
                    required
                    name="country"
                    value={
                      form.country
                    }
                    onChange={change}
                    className="mt-2 h-11 w-full rounded-md border border-[#D0D0D0] px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">

                  <input
                    type="checkbox"
                    name="is_default"
                    checked={
                      form.is_default
                    }
                    onChange={change}
                    className="h-4 w-4 cursor-pointer accent-[#2874F0]"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-[#212121]">
                      Set as default address
                    </span>

                    <span className="mt-0.5 block text-xs text-[#878787]">
                      Use this address automatically during checkout.
                    </span>
                  </span>

                </label>

              </div>

              {/* MODAL ACTIONS */}
              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#E0E0E0] pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={busy}
                  className="cursor-pointer rounded-md border border-[#D0D0D0] px-6 py-3 text-sm font-bold text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={busy}
                  className="cursor-pointer rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Save Address"}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Addresses;