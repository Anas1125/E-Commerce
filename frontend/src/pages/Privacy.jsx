import { useContext } from "react";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

function Privacy() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-8 sm:px-6 lg:px-8">
      <SEO
        title="Privacy Policy"
        description={`Read the ${siteName} Privacy Policy to understand how information is collected, used, and protected when you use our website.`}
      />
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
            {siteName}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#212121] sm:text-4xl">
            Privacy Policy
          </h1>

          <p className="mt-2 text-sm text-[#878787]">
            Last updated: October 2026
          </p>
        </div>

        {/* CONTENT */}
        <div className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white">

          <div className="border-b border-[#E0E0E0] bg-[#FAFAFA] px-6 py-5 sm:px-8">
            <p className="text-sm leading-6 text-[#555]">
              This Privacy Policy explains how {siteName} may collect,
              use and protect information when you use our website,
              create an account or place an order.
            </p>
          </div>

          <div className="divide-y divide-[#F0F0F0]">

            {/* 1 */}
            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-lg font-bold text-[#212121]">
                1. Information We Collect
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                {siteName} may collect information that you provide
                when creating an account, placing an order,
                contacting us, or using our website. This may
                include your name, email address, phone number,
                shipping address, and order information.
              </p>
            </section>

            {/* 2 */}
            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-lg font-bold text-[#212121]">
                2. How We Use Information
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                Information may be used to process orders, provide
                customer support, improve our website, manage
                accounts, and communicate important information
                about your purchases.
              </p>
            </section>

            {/* 3 */}
            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-lg font-bold text-[#212121]">
                3. Payments
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                Payment information is handled through the payment
                methods available during checkout. {siteName} does
                not intentionally store sensitive payment
                credentials unless required for the operation of
                the service.
              </p>
            </section>

            {/* 4 */}
            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-lg font-bold text-[#212121]">
                4. Cookies
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                Our website may use cookies or similar technologies
                to maintain sessions, remember preferences, and
                improve the shopping experience.
              </p>
            </section>

            {/* 5 */}
            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-lg font-bold text-[#212121]">
                5. Data Security
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                We take reasonable measures to protect information
                handled through our website. However, no online
                service can guarantee complete security.
              </p>
            </section>

            {/* 6 */}
            <section className="px-6 py-7 sm:px-8">
              <h2 className="text-lg font-bold text-[#212121]">
                6. Contact
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#555]">
                If you have questions about this Privacy Policy,
                contact us at{" "}
                <a
                  href="mailto:hello@Terralens.com"
                  className="cursor-pointer font-semibold text-[#2874F0] hover:underline"
                >
                  hello@terralens.com
                </a>
                .
              </p>
            </section>
          </div>

          {/* FOOTER */}
          <div className="border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4 sm:px-8">
            <p className="text-xs leading-5 text-[#878787]">
              By using the {siteName} website, you acknowledge that
              you have read this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Privacy;