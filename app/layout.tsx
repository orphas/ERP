import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { APP_BASE_PATH } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "ERP SGICR",
  description: "Enterprise Resource Planning System",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script id="prefix-api-basepath" strategy="beforeInteractive">
          {`
            (() => {
              const basePath = ${JSON.stringify(APP_BASE_PATH)};
              const originalFetch = window.fetch.bind(window);

              window.fetch = (input, init) => {
                try {
                  if (typeof input === "string" || input instanceof URL) {
                    const url = new URL(String(input), window.location.href);
                    const needsPrefix =
                      url.origin === window.location.origin &&
                      url.pathname.startsWith("/api/") &&
                      !url.pathname.startsWith(basePath + "/");

                    if (needsPrefix) {
                      url.pathname = basePath + url.pathname;
                      return originalFetch(url.toString(), init);
                    }
                  }
                } catch {
                  // fall through to the original request
                }

                return originalFetch(input, init);
              };
            })();
          `}
        </Script>
        <Script id="strip-fdprocessedid" strategy="beforeInteractive">
          {`
            (() => {
              const attr = "fdprocessedid";
              const strip = () => {
                document.querySelectorAll("[fdprocessedid]").forEach((node) => {
                  node.removeAttribute(attr);
                });
              };
              strip();
              const observer = new MutationObserver(() => strip());
              observer.observe(document.documentElement, {
                attributes: true,
                childList: true,
                subtree: true,
              });
            })();
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
