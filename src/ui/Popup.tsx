import { useEffect, useRef } from 'react';

/** Aviso modal: el cambio no se ha guardado. */
export function Popup({ texto, onCerrar }: { texto: string; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="popup"
      role="alertdialog"
      aria-labelledby="popup-titulo"
      aria-describedby="popup-texto"
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <h2 id="popup-titulo">No se puede marcar</h2>
      <p id="popup-texto">{texto}</p>
      <form method="dialog">
        <button type="submit" autoFocus>
          Entendido
        </button>
      </form>
    </dialog>
  );
}
