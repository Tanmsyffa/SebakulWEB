import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const root = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: root });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // These are upload previews. Their local/blob URLs cannot use Next image optimization.
  { files: ['src/app/(dashboard)/warung/{menu,sewa}/*-client.tsx'], rules: { '@next/next/no-img-element': 'off' } },
  { ignores: ['.next/**', '.next-dev/**', 'node_modules/**'] },
];
