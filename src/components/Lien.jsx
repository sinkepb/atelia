import { navigate } from "../lib/router.js";

// <a> qui navigue sans recharger la page (clic gauche simple uniquement :
// Ctrl/Cmd+clic ouvre toujours un nouvel onglet).
export function Lien({ to, children, ...props }) {
  function onClick(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }
  return <a href={to} onClick={onClick} {...props}>{children}</a>;
}
