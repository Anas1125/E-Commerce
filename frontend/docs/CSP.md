# Storefront Content Security Policy

Cloudflare Pages serves the Vite build and copies public/_headers into dist. The policy is initially report-only: it reports violations in the browser console rather than blocking resources. No reporting collector is configured. The other headers are enforced immediately.

The policy permits the current Vercel API origin, the Razorpay checkout script and Razorpay network/frame origins, HTTPS images (including Vercel Blob and arbitrary catalogue images), blob/data image previews and existing React inline styles. Inline executable scripts, eval, plugins and unrelated network origins are not permitted by the proposed policy. The policy does not grant CORS permissions or replace server-side access checks. JSON-LD is non-executable metadata; verify it remains present in the rendered DOM.

## Verify before enforcing

1. Deploy a Pages preview or the production build in report-only mode.
2. Run:
   ```sh
   curl -sI https://e-commerce-3q5.pages.dev/
   curl -sI https://e-commerce-3q5.pages.dev/admin/login
   ```
   Confirm Content-Security-Policy-Report-Only, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy on HTML responses. Pages Functions responses are not covered by _headers (the sitemap function returns XML, not the storefront).
3. Use a clean browser profile, open DevTools Console and Network, and hard refresh. Test home, products, categories, search, both login flows, registration/password reset, cart, checkout, order history, admin image previews/uploads and branding changes. Test Razorpay in test mode including opening/closing its frame and completing or cancelling a test payment, if online checkout is enabled. Test mobile too.
4. Investigate report-only messages; distinguish browser extensions from genuine site resources. If a legitimate dependency needs another origin, allow only that specific origin/directive. If the frontend API origin changes, update connect-src to match VITE_API_BASE_URL. Do not add unsafe-inline or unsafe-eval to script-src to suppress warnings.
5. After the flows are verified, change Content-Security-Policy-Report-Only to Content-Security-Policy in public/_headers, rebuild and deploy. Confirm the enforced header with curl and repeat the flow checks. If necessary, roll back that header name to report-only while investigating.

CSP is defense in depth. Keep backend input validation, authorization, output escaping and dependency updates. Browser-storage authentication tokens remain a separate risk.
