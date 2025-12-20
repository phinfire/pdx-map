import { defineConfig } from 'vitest/config';
import angular from '@angular/build/vitest';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['src/test-setup.ts'],
  },
});
