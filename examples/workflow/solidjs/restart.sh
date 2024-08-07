cd ../../..

bun install
npm run build

cd examples/workflow/solidjs

npm install @upstash/qstash@file:../../../dist
npm run dev