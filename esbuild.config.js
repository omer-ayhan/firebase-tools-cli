const esbuild = require('esbuild');

const isDev = process.env.NODE_ENV === 'development';

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/index.js',
  external: [
    'firebase-admin',
    'google-auth-library',
    '@google-cloud/*',
    'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'querystring', 
    'stream', 'util', 'events', 'buffer', 'child_process'
  ],
  minify: true,
  treeShaking: true,
  target: 'node14',
  banner: {
    js: '#!/usr/bin/env node'
  },

  ...(isDev && { metafile: true })
}).then(result => {
  console.log('Build complete!');
  
  if (isDev && result.metafile) {
    require('fs').writeFileSync('meta.json', JSON.stringify(result.metafile));
    console.log('Metafile written to meta.json');
  }
}).catch(() => process.exit(1));