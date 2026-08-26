// Analytics loader.
//
// index.html previously referenced `%VITE_ANALYTICS_ENDPOINT%/umami` directly.
// When VITE_ANALYTICS_ENDPOINT was undefined, Vite left the literal `%VITE_ANALYTICS_ENDPOINT%`
// in the HTML, so the browser requested `/%VITE_ANALYTICS_ENDPOINT%/umami` on every
// page load — a 400 response plus a console error.
//
// This module only injects the analytics script when both env vars are present,
// so dev/preview builds without analytics configured stay clean.

const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;

if (
  endpoint &&
  websiteId &&
  typeof document !== "undefined" &&
  !document.querySelector('script[data-website-id="' + websiteId + '"]')
) {
  const script = document.createElement("script");
  script.defer = true;
  script.async = true;
  script.src = `${endpoint}/umami`;
  script.setAttribute("data-website-id", websiteId);
  document.head.appendChild(script);
}
