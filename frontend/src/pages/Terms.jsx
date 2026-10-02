import { useContext } from "react";
import { FileText, Mail } from "lucide-react";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

function Terms() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-8 sm:px-6 sm:py-12">
      <SEO
        title="Terms & Conditions"
        description={`Read the ${siteName} Terms & Conditions for information about using the website, purchasing products, accounts, orders, and pricing.`}
      />
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
            {siteName}
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[#212121] sm:text-3xl">
            Terms & Conditions
          </h1>

          <p className="mt-2 text-sm text-[#878787]">
            Last updated: October 2026
          </p>
        </div>

        {/* CONTENT */}
        <div className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white">

          {/* TOP BAR */}
          <div className="flex items-center gap-4 border-b border-[#E0E0E0] px-5 py-5 sm:px-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#E8F0FE] text-[#2874F0]">
              <FileText size={21} />
            </div>

            <div>
              <h2 className="text-base font-bold text-[#212121]">
                Website Terms
              </h2>

              <p className="mt-1 text-xs text-[#878787]">
                Please read these terms before using {siteName}.
              </p>
            </div>
          </div>

          {/* SECTIONS */}
          <div className="divide-y divide-[#E0E0E0]">

            <section className="px-5 py-6 sm:px-7">
              <h2 className="text-base font-bold text-[#212121]">
                1. About These Terms
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                These Terms & Conditions describe the general rules for using
                the {siteName} website and purchasing products through our
                online store.
              </p>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <h2 className="text-base font-bold text-[#212121]">
                2. Using Our Website
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                You agree to use the website lawfully and not to interfere with
                the operation or security of the service.
              </p>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <h2 className="text-base font-bold text-[#212121]">
                3. Products & Pricing
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                Product information, availability, prices, and offers may
                change from time to time. We aim to keep information accurate,
                but errors may occasionally occur.
              </p>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <h2 className="text-base font-bold text-[#212121]">
                4. Orders
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                Placing an order does not necessarily guarantee acceptance.
                Orders may be reviewed, cancelled, or adjusted where necessary
                due to availability, pricing errors, or other operational
                reasons.
              </p>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <h2 className="text-base font-bold text-[#212121]">
                5. Accounts
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                If you create an account, you are responsible for keeping your
                login information secure and for activities performed through
                your account.
              </p>
            </section>

            {/* CONTACT */}
            <section className="bg-[#FAFAFA] px-5 py-6 sm:px-7">
              <h2 className="text-base font-bold text-[#212121]">
                6. Contact
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                Questions about these terms can be sent to:
              </p>

              <a
                href="mailto:hello@terralens.com"
                className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#2874F0] hover:text-[#1f65d6]"
              >
                <Mail size={16} />
                hello@terralens.com
              </a>
            </section>

          </div>
        </div>

        {/* FOOTER NOTE */}
        <p className="mt-5 text-center text-xs text-[#878787]">
          By using the {siteName} website, you agree to follow these terms.
        </p>

      </div>
    </div>
  );
}

export default Terms;