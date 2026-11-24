# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## SEO (Cloudflare Pages)

The live /sitemap.xml Pages Function replaces the static XML and lists active products, categories and public pages using the public catalogue API. Search and private pages are omitted. If the API fails, the sitemap returns 503 instead of an incomplete list. robots.txt is copied from public/.

Default canonical origin: https://e-commerce-3q5.pages.dev. Default sitemap API: https://e-commerce-api-lac-psi.vercel.app. For a domain change set VITE_SITE_URL at build time, PUBLIC_SITE_URL in Pages Functions, and update robots.txt. PUBLIC_API_URL overrides the sitemap backend.

Verify the Pages preview sitemap, robots.txt, product and category titles/canonicals, structured data, and noindex on private and missing pages. Metadata is client-rendered; crawlers that do not execute JavaScript see generic HTML. Robots rules are not access control. Submit the sitemap in Search Console when ready.
