import { createContext, useCallback, useContext, useState } from "react";

// Notifications éphémères (« Enregistré », « Leçon terminée »…) en bas de
// l'écran, à la place des messages fixes ou des alert() du navigateur.
const ToastsContext = createContext(() => {});

export function useToast() {
  return useContext(ToastsContext);
}

export function ToastsProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const afficher = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastsContext.Provider value={afficher}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === "ok" ? "✓ " : t.type === "erreur" ? "⚠ " : ""}{t.message}
          </div>
        ))}
      </div>
    </ToastsContext.Provider>
  );
}
