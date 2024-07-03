
pnpm uninstall @upstash/qstash
cd ../..
pnpm build
cd examples/workflow
pnpm install @upstash/qstash@file:../../dist
source .env
pnpm dev