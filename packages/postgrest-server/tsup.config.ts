import type { Options } from 'tsup';

export const tsup: Options = {
  dts: true,
  entry: {
    index: 'src/index.ts',
    stores: 'src/stores/index.ts',
  },
  external: [/^@supabase\//],
  format: ['cjs', 'esm'],
  //   inject: ['src/react-shim.js'],
  // ! .cjs/.mjs doesn't work with Angular's webpack4 config by default!
  legacyOutput: false,
  sourcemap: true,
  splitting: false,
  bundle: true,
  clean: true,
};
