import { Link } from "react-router-dom";
import {
  ArrowRight,
  Leaf,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { resolveMediaUrl } from "../services/api";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]/40 focus-visible:ring-offset-2";

const whyBlocks = [
  {
    Icon: Leaf,
    title: "Thoughtfully selected",
    copy: "A considered collection chosen for everyday living.",
  },
  {
    Icon: ShieldCheck,
    title: "Secure shopping",
    copy: "Your account and checkout are protected.",
  },
  {
    Icon: PackageCheck,
    title: "Reliable service",
    copy: "Clear updates from order to delivery.",
  },
  {
    Icon: Sparkles,
    title: "Here to help",
    copy: "Support when you need a hand.",
  },
];

export function PageIntro({ eyebrow, title, description, children }) {
  return (
    <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6A716B]">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, to, linkText = "Explore all" }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {to && (
        <Link
          className={`inline-flex items-center gap-2 rounded text-sm font-medium text-[#486B57] transition-all duration-200 hover:gap-3 motion-reduce:transition-none motion-reduce:hover:gap-2 ${focusRing}`}
          to={to}
        >
          {linkText}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, text, action, to = "/shop" }) {
  return (
    <div className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6A716B]">
        {text}
      </p>
      {action && (
        <Link className="button-primary mt-6 inline-flex" to={to}>
          {action}
        </Link>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading your store…" }) {
  return (
    <div className="py-16 text-center text-sm text-[#6A716B]" role="status">
      {label}
    </div>
  );
}

export function ErrorState({ message, retry }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-12 text-center"
    >
      <p className="text-sm text-[#6A716B]">{message}</p>
      {retry && (
        <button
          type="button"
          className={`mt-4 cursor-pointer rounded text-sm font-semibold text-[#486B57] ${focusRing}`}
          onClick={retry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function CategoryCard({ category, image }) {
  if (!category?.slug) return null;

  const rawImage = image || category.image_url;
  const categoryImage = rawImage ? resolveMediaUrl(rawImage) : "";

  return (
    <Link
      to={`/categories/${category.slug}`}
      className={`group relative flex min-h-64 items-end overflow-hidden rounded-2xl border border-[#E3E5DF] bg-[#DCE7DE] p-6 transition hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`}
    >
      {categoryImage ? (
        <img
          src={categoryImage}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#fff8,_transparent_60%),linear-gradient(145deg,#e8eee7,#cddbd0)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#1f2521a8] via-transparent to-transparent" />

      <div className="relative flex w-full items-end justify-between text-white">
        <div>
          <h3 className="text-xl font-semibold">{category.name}</h3>
          <p className="mt-1 text-sm text-white/80">Explore the collection</p>
        </div>
        <span className="rounded-full bg-white/20 p-2 transition group-hover:bg-white group-hover:text-[#486B57] motion-reduce:transition-none">
          <ArrowRight size={18} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export function WhyTerraLens() {
  return (
    <section className="border-y border-[#E3E5DF] bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionTitle eyebrow="The TerraLens way" title="Why TerraLens?" />
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {whyBlocks.map(({ Icon, title, copy }) => (
            <div key={title}>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#DCE7DE] text-[#486B57]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6A716B]">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function toAmount(value) {
  const amount =
    typeof value === "string"
      ? Number(value.replace(/,/g, "").trim())
      : Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

export function Price({ value, className = "" }) {
  const amount = toAmount(value);
  const digits = Number.isInteger(amount) ? 0 : 2;

  return (
    <span className={className}>
      ₹
      {amount.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}
    </span>
  );
}