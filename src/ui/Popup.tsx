import { useEffect, useRef } from 'react';

export interface MensajePopup {
  /** «rechazo»: el cambio no se ha guardado. «aviso»: se ha guardado, pero conviene saberlo. */
  tipo: 'rechazo' | 'aviso';
  texto: string;
}

const TITULO: Record<MensajePopup['tipo'], string> = {
  rechazo: 'No se puede marcar',
  aviso: 'Aviso',
};

export function Popup({ mensaje, onCerrar }: { mensaje: MensajePopup; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`popup ${mensaje.tipo}`}
      role="alertdialog"
      aria-labelledby="popup-titulo"
      aria-describedby="popup-texto"
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <h2 id="popup-titulo">{TITULO[mensaje.tipo]}</h2>
      <p id="popup-texto">{mensaje.texto}</p>
      <form method="dialog">
        <button type="submit" autoFocus>
          Entendido
        </button>
      </form>
    </dialog>
  );
}
