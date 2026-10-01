import { Link } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";

function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">404 — Page not found</p>

        <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[#1F2521] sm:text-7xl">
          Looks like you took a wrong turn.
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#737A74]">
          The page you're looking for doesn't exist or may have been moved.
          Let's get you back to TerraLens.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#486B57] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#385744]"
          >
            <Home size={17} />
            Back to Home
          </Link>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-full border border-[#E3E5DF] bg-white px-6 py-3 text-sm font-semibold text-[#1F2521] transition hover:bg-[#F5F5F1]"
          >
            <ArrowLeft size={17} />
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}

export default NotFound;