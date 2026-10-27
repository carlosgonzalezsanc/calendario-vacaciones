import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base relativa: la web se puede servir como estática desde cualquier carpeta.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
