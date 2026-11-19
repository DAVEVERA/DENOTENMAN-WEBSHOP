const SCRIPT_SAFE_LT = "\\u003c";

/**
 * Renders a JSON-LD block.
 *
 * The escaping is the whole point of having one component: inlining JSON
 * into a <script> lets any string containing a closing script tag end the
 * element early and run as markup. Two call sites previously escaped with a
 * single-backslash literal, which is a no-op at runtime (the JS string is
 * just "<"), so category names and breadcrumb labels went in raw.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, SCRIPT_SAFE_LT),
      }}
    />
  );
}
