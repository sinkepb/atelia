import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Boîtes de dialogue intégrées au site (confirmation, saisie d'un titre),
// utilisables comme des promesses : `await confirmer({...})` → true/false,
// `await demander({...})` → texte saisi ou null. Remplacent window.confirm /
// window.prompt, peu lisibles et non stylables.
const DialoguesContext = createContext(null);

export function useDialogues() {
  return useContext(DialoguesContext);
}

export function DialoguesProvider({ children }) {
  const [dialogue, setDialogue] = useState(null);

  const ouvrir = useCallback((options) => new Promise((resolve) => setDialogue({ ...options, resolve })), []);
  const api = useMemo(() => ({
    confirmer: (o) => ouvrir({ ...o, mode: "confirmer" }),
    demander: (o) => ouvrir({ ...o, mode: "demander" }),
  }), [ouvrir]);

  function fermer(valeur) {
    dialogue.resolve(valeur);
    setDialogue(null);
  }

  return (
    <DialoguesContext.Provider value={api}>
      {children}
      {dialogue && <Dialogue {...dialogue} onFermer={fermer} />}
    </DialoguesContext.Provider>
  );
}

function Dialogue({ mode, titre, message, libelle, valeur = "", confirmer = "Valider", danger, onFermer }) {
  const [saisie, setSaisie] = useState(valeur);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function valider(e) {
    e.preventDefault();
    if (mode === "demander") onFermer(saisie.trim() || null);
    else onFermer(true);
  }

  return (
    <dialog ref={ref} className="dialogue" onCancel={(e) => { e.preventDefault(); onFermer(mode === "demander" ? null : false); }}>
      <form onSubmit={valider} className="formulaire">
        <h3>{titre}</h3>
        {message && <p className="muted">{message}</p>}
        {mode === "demander" && (
          <label>
            {libelle}
            <input autoFocus required value={saisie} onChange={(e) => setSaisie(e.target.value)} />
          </label>
        )}
        <div className="boutons boutons-fin">
          <button type="button" className="btn btn-secondaire"
            onClick={() => onFermer(mode === "demander" ? null : false)}>Annuler</button>
          <button className={`btn ${danger ? "btn-danger" : ""}`} autoFocus={mode === "confirmer"}>{confirmer}</button>
        </div>
      </form>
    </dialog>
  );
}
