import { useEffect, useMemo } from "react";

/**
 * Injects a JSON-LD structured data block into the document head while the
 * component is mounted, and removes it on unmount. Use for per-page Dataset,
 * Place, or other schema.org entities that can't be baked into the base HTML.
 *
 * Serializes data to a stable JSON string so that new object identities on
 * each render (a common React pitfall) don't cause the script tag to be
 * torn down and re-created in a loop.
 */
export function useStructuredData(id: string, data: Record<string, unknown> | null) {
  const serialized = useMemo(() => (data ? JSON.stringify(data) : null), [data]);
  useEffect(() => {
    if (!serialized) return;
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    script.text = serialized;
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [id, serialized]);
}

/**
 * Build schema.org Dataset + Place JSON-LD for a single county page.
 */
export function buildCountyStructuredData(county: {
  name: string;
  state: string;
  stateAbbr: string;
  fips: string;
  population?: number | null;
  lat?: number | null;
  lng?: number | null;
  healthEquityGapScore?: number | null;
}) {
  const pageUrl = `https://www.thepulseatlas.com/county/${county.fips}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        "@id": `${pageUrl}#dataset`,
        name: `${county.name}, ${county.state} \u2014 Health Equity Data`,
        description: `County-level health equity metrics for ${county.name}, ${county.state} (FIPS ${county.fips}). Includes Health Equity Gap Score, uninsured rate, maternal mortality, chronic disease prevalence, provider shortage, social vulnerability, and ranked evidence-based intervention recommendations.`,
        url: pageUrl,
        isPartOf: {
          "@type": "Dataset",
          name: "Pulse U.S. County Health Equity Atlas Dataset",
          url: "https://www.thepulseatlas.com",
        },
        identifier: `FIPS:${county.fips}`,
        creator: {
          "@type": "Organization",
          name: "Pulse: U.S. Health Equity Atlas",
          url: "https://www.thepulseatlas.com",
        },
        license: "https://creativecommons.org/licenses/by/4.0/",
        isAccessibleForFree: true,
        spatialCoverage: {
          "@type": "Place",
          name: `${county.name}, ${county.state}`,
          address: {
            "@type": "PostalAddress",
            addressRegion: county.stateAbbr,
            addressCountry: "US",
            addressLocality: county.name,
          },
          ...(county.lat != null && county.lng != null
            ? {
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: county.lat,
                  longitude: county.lng,
                },
              }
            : {}),
        },
        temporalCoverage: "2018/2024",
        ...(county.healthEquityGapScore != null
          ? {
              variableMeasured: [
                {
                  "@type": "PropertyValue",
                  name: "Health Equity Gap Score",
                  value: county.healthEquityGapScore,
                  unitText: "score (0-100 composite)",
                },
              ],
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Pulse Atlas",
            item: "https://www.thepulseatlas.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: county.state,
            item: `https://www.thepulseatlas.com/state/${county.stateAbbr}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${county.name}, ${county.state}`,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
