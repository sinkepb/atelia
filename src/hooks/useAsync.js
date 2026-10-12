import { useEffect, useRef, useState } from "react";

// Charge une donnée asynchrone, relancée quand une valeur de `deps` change
// (valeurs simples : chaînes, identifiants) ; `recharger()` force un rechargement.
export function useAsync(charger, deps) {
  const [etat, setEtat] = useState({ chargement: true, data: null, erreur: null });
  const [version, setVersion] = useState(0);
  const chargerRef = useRef(charger);
  // Déclaré avant l'effet de chargement : les effets s'exécutent dans l'ordre,
  // le chargement voit donc toujours la dernière fonction `charger`.
  useEffect(() => { chargerRef.current = charger; });
  const cle = deps.map(String).join("|");

  useEffect(() => {
    let actif = true;
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    chargerRef.current().then(
      (data) => actif && setEtat({ chargement: false, data, erreur: null }),
      (erreur) => actif && setEtat({ chargement: false, data: null, erreur }),
    );
    return () => { actif = false; };
  }, [cle, version]);

  return { ...etat, recharger: () => setVersion((v) => v + 1) };
}
