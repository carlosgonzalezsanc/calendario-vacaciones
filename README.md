# Calendario de vacaciones

Web para planificar las vacaciones según el III Convenio colectivo de empresas vinculadas (y su prórroga hasta 2030). Sustituye al Excel de cálculo de vacaciones.

**Abrir la web:** https://carlosgonzalezsanc.github.io/calendario-vacaciones/

- Elige tu localidad: Madrid, Toledo, Almería, Burgos, Vigo o Las Palmas de Gran Canaria. Verás los festivos nacionales, autonómicos, locales y de convenio.
- Marca los días sobre el calendario con un pincel: vacaciones por bloques, remanente de vacaciones, asuntos propios, no imputables, bajas, permisos por convenio y Día de San Isidro.
- La web comprueba las reglas: inicio de bloque, separación entre bloques de 5 días, cupos… Además, no deja que dos marcas se pisen.

🔒 **Privacidad:** no hay servidor ni registro. Los datos se guardan solo en el navegador de cada persona (`localStorage`). Se pueden exportar e importar en JSON, y hay un botón para borrarlos.

> ⚠️ Herramienta de apoyo, no oficial. Algunos festivos locales y algunas reglas heredadas del Excel están marcados como «pendiente de verificar»: ver [`docs/reglas.md`](docs/reglas.md).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests del dominio (Vitest)
npm run build    # web estática en dist/
```

Los festivos están en `data/festivos/AAAA.json` y las localidades en `data/localidades.json`. Para añadir un año o una localidad basta con editar esos datos. Cada push a `main` se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).
