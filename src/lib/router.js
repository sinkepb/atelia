import { useSyncExternalStore } from "react";

function abonner(cb) {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (!replace) window.scrollTo(0, 0);
}

export function useLocation() {
  const href = useSyncExternalStore(abonner, () => window.location.pathname + window.location.search);
  const url = new URL(href, window.location.origin);
  return { pathname: url.pathname, query: url.searchParams };
}
