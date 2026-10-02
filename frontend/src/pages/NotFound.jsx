import { Link } from "react-router-dom";
import { ArrowLeft, Home, Search } from "lucide-react";

function NotFound() {
  return (
    <main className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <div className="w-full rounded-md border border-[#E0E0E0] bg-white px-6 py-12 text-center sm:px-10 sm:py-16">

          {/* 404 */}
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#E8F0FE]">
            <span className="text-3xl font-bold text-[#2874F0]">
              404
            </span>
          </div>

          <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
            Page not found
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#212121] sm:text-4xl">
            Looks like you took a wrong turn.
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#878787]">
            The page you're looking for doesn't exist or may have
            been moved. Let's get you back to TerraLens.
          </p>

          {/* ACTIONS */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
            >
              <Home size={17} />
              Back to Home
            </Link>

            <Link
              to="/shop"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-6 py-3 text-sm font-bold text-[#212121] transition hover:border-[#2874F0] hover:bg-[#F5F9FF] hover:text-[#2874F0]"
            >
              <Search size={17} />
              Browse Products
            </Link>

            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-6 py-3 text-sm font-bold text-[#212121] transition hover:bg-[#F1F3F6]"
            >
              <ArrowLeft size={17} />
              Go Back
            </button>
          </div>

          {/* HELPER */}
          <div className="mx-auto mt-10 max-w-md border-t border-[#F0F0F0] pt-6">
            <p className="text-xs text-[#878787]">
              You can return home, browse our products, or go back
              to the previous page.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default NotFound;