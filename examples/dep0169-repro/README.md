# DEP0169 repro (`url.parse()` deprecation)

Minimal reproduction attempt for the report that `@upstash/qstash` 2.11.0
(via `crypto-js` 4.2.0) emits `[DEP0169] DeprecationWarning: url.parse() ...`
on Node.js 24.

```sh
nvm use 24
npm install
npm start                # exercises Receiver.verify (crypto-js SHA256 path) + client
npm run start:demo-warning   # same, then calls url.parse() from app code to show the warning
```

Notes on DEP0169 (Node 24): it is an *application* deprecation — emitted once
per process, and only when the immediate caller of `url.parse()` /
`url.format(string)` / `url.resolve()` lives outside `node_modules`.

## Findings (Node v24.14.0)

- `@upstash/qstash@2.11.0` + `crypto-js@4.2.0`: `npm start` → `Warnings emitted: 0`.
- `crypto-js` contains no `url.parse()` call; `grep "url\.parse("` matches the
  JSDoc `CryptoJS.enc.Base64url.parse(...)` in `enc-base64url.js` / `crypto-js.js`.
  Neither `@upstash/qstash`, `jose` nor `neverthrow` reference `node:url` at all.
- Where the warning *can* come from: a direct `url.parse()` only warns when the
  caller is outside `node_modules` (or bundled out of it, e.g. into
  `.next/server/chunks`). But `url.resolve()` and `url.format(string)` warn even
  when called from a dependency inside `node_modules` (nodejs/node#61724), and
  the message still says `url.parse()`. So the source is usually another
  dependency; run with `NODE_OPTIONS=--trace-deprecation` to get the exact
  file — the frame right below `urlParse (node:url)` names it.
