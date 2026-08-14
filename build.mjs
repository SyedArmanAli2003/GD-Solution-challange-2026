import * as esbuild from 'esbuild'

const pages = ['auth', 'coordinator', 'reporter', 'volunteers', 'resources', 'history', 'account']

await esbuild.build({
  entryPoints: pages.map(p => `src/${p}.js`),
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: false,
  minify: false,
  external: ['crypto'],
  define: {
    'process.env.SUPABASE_URL': JSON.stringify('https://ckjiukvxqqvjmpxhpclb.supabase.co'),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraml1a3Z4cXF2am1weGhwY2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjYxMTgsImV4cCI6MjA5ODEwMjExOH0.VWi7wlZdGKVF0q-9bF3bStOh6w-dW1eK9l-PqzBJmjI'),
    'process.env.OPENROUTER_API_KEY': JSON.stringify(''),
  },
})

console.log('Build complete')
