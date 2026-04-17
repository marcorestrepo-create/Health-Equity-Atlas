import { useEffect } from "react";

/**
 * Sets document.title and the meta description tag dynamically.
 * @param title - The page title to set.
 * @param description - Optional meta description to set (falls back to the default).
 */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title;

    if (description) {
      const metaDesc = document.querySelector("meta[name='description']");
      if (metaDesc) {
        metaDesc.setAttribute("content", description);
      }
    }

    return () => {
      // Restore defaults on unmount
      document.title = "Pulse \u2014 U.S. Health Equity Atlas";
      const metaDesc = document.querySelector("meta[name='description']");
      if (metaDesc) {
        metaDesc.setAttribute(
          "content",
          "Interactive county-by-county atlas mapping health equity gaps across 3,144 U.S. counties. Insurance, maternal mortality, chronic disease, provider shortages, and more."
        );
      }
    };
  }, [title, description]);
}
