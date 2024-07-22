cd ../../..

bun install
npm run build

cd examples/workflow/nuxt

npm install @upstash/qstash@file:../../../dist

pnpm dev