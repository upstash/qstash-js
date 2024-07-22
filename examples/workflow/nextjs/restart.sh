cd ../../..

npm install
npm run build

cd examples/workflow/nextjs

npm install @upstash/qstash@file:../../../dist

pnpm dev