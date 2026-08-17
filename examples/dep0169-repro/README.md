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
