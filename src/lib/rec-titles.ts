// Compares an LLM-claimed title against a TMDb-resolved title. Strips
// leading articles, drops punctuation, and lowercases. Conservative on
// purpose — false negatives (matching titles deemed incompatible) just
// trigger a fallback search, but false positives let mismatched recs
// through (the Silicon-Valley-with-Dark's-blurb bug).
export function titlesAreCompatible(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      // strip leading article BEFORE stripping punctuation so we can rely on
      // the trailing space marker
      .replace(/^(the|a|an)\s+/, "")
      // collapse all non-alphanumeric chars (incl. spaces, punctuation,
      // accents we don't normalize, etc.) — so "M*A*S*H" === "MASH" and
      // "Million Little Things" === "millionlittlethings"
      .replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb;
}
