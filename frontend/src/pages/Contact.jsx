
import { useContext } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  Package,
  ShoppingBag,
} from "lucide-react";

import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

const SUPPORT_EMAIL = "hello@terralens.com";

function Contact() {
  const branding = useContext(SiteBrandingContext) || {};
  const { siteName = "TerraLens" } = branding;
  const [searchParams] = useSearchParams();

  const orderRef = searchParams.get("order")?.trim();

  const subject = orderRef
    ? `Help with order ${orderRef}`
    : `Customer support - ${siteName}`;

  const body = orderRef
    ? `Hello ${siteName} Support,

I need help with order ${orderRef}.

Issue:



Thank you.`
    : `Hello ${siteName} Support,

I need help with:




Thank you.`;

  const emailHref =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <>
      <SEO
        title="Contact Us"
        description={`Contact ${siteName} for help with orders, deliveries, products, payments, returns, and refunds.`}
      />

      <main className="min-h-screen bg-[#F5F5F1] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#486B57]">
              We're here to help
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1F2521] sm:text-5xl">
              Get in touch
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#6A716B] sm:text-base">
              Need help with an order or have a question about a product?
              Contact our support team and tell us how we can help.
            </p>
          </div>

          {orderRef && (
            <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-[#DCE7DE] bg-white p-4 sm:p-5">
              <p className="text-sm font-semibold text-[#1F2521]">
                You're contacting us about order:
              </p>

              <p className="mt-1 break-all text-sm font-medium text-[#486B57]">
                {orderRef}
              </p>

              <p className="mt-2 text-xs leading-5 text-[#6A716B]">
                Your order reference will be included in the support email.
              </p>
            </div>
          )}

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-[#E3E5DF] bg-white p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DCE7DE] text-[#385744]">
                <Mail size={23} aria-hidden="true" />
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#1F2521]">
                Email support
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#6A716B]">
                Send us your question, include any relevant order details,
                and explain how we can assist you.
              </p>

              <a
                href={emailHref}
                className="mt-5 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-[#486B57] hover:underline"
              >
                {SUPPORT_EMAIL}
                <ArrowRight
                  size={16}
                  className="shrink-0"
                  aria-hidden="true"
                />
              </a>

              <p className="mt-4 text-xs leading-5 text-[#858B85]">
                This opens your default email application with a prepared
                message. Review it and send it to contact support.
              </p>
            </section>

            <section className="rounded-2xl border border-[#E3E5DF] bg-white p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#1F2521]">
                Quick links
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#6A716B]">
                You can also find answers and manage your shopping
                directly from your account.
              </p>

              <div className="mt-6 space-y-3">
                <Link
                  to="/orders"
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E3E5DF] px-4 py-3 text-sm font-semibold text-[#1F2521] transition hover:border-[#486B57] hover:bg-[#F5F8F4]"
                >
                  <span className="flex items-center gap-3">
                    <Package size={18} aria-hidden="true" />
                    My orders
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>

                <Link
                  to="/shop"
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E3E5DF] px-4 py-3 text-sm font-semibold text-[#1F2521] transition hover:border-[#486B57] hover:bg-[#F5F8F4]"
                >
                  <span className="flex items-center gap-3">
                    <ShoppingBag size={18} aria-hidden="true" />
                    Browse products
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/"
              className="text-sm font-semibold text-[#486B57] hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export default Contact;
