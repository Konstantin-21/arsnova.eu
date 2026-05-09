#!/usr/bin/env node
/**
 * Realtime-Lasttest für `session.onStatusChanged`.
 *
 * Öffnet viele tRPC-WebSocket-Subscriptions parallel und hält sie für die angegebene Dauer offen.
 *
 * Beispiele:
 *   SESSION_CODE=AB12CD node scripts/load/ws-status-subscribers.mjs
 *   SESSION_CODE=AB12CD CLIENTS=500 DURATION_MS=60000 WS_URL=ws://127.0.0.1:3001 node scripts/load/ws-status-subscribers.mjs
 */
let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule = await import('../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

let wsModule;
try {
  wsModule = await import('ws');
} catch {
  wsModule = await import('../../apps/frontend/node_modules/ws/wrapper.mjs');
}

const { createTRPCProxyClient, createWSClient, wsLink } = trpcClientModule;
const WebSocketPonyfill = globalThis.WebSocket ?? wsModule.WebSocket ?? wsModule.default;
if (!globalThis.WebSocket && WebSocketPonyfill) {
  globalThis.WebSocket = WebSocketPonyfill;
}

const sessionCode = String(process.env.SESSION_CODE || '')
  .trim()
  .toUpperCase();
const wsUrl = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();
const clients = Math.max(1, Number(process.env.CLIENTS || 500));
const durationMs = Math.max(5_000, Number(process.env.DURATION_MS || 60_000));

if (!/^[A-Z0-9]{6}$/.test(sessionCode)) {
  console.error('Bitte SESSION_CODE setzen (genau 6 Zeichen, z. B. SESSION_CODE=AB12CD).');
  process.exit(1);
}

const wsClient = createWSClient({
  url: wsUrl,
  lazy: { enabled: false, closeMs: 0 },
  retryDelayMs: () => 1_000,
});

const trpc = createTRPCProxyClient({
  links: [wsLink({ client: wsClient })],
});

let opened = 0;
let messages = 0;
let errors = 0;
/** @type {Array<{ unsubscribe: () => void }>} */
const subscriptions = [];

for (let index = 0; index < clients; index += 1) {
  const subscription = trpc.session.onStatusChanged.subscribe(
    { code: sessionCode },
    {
      onStarted() {
        opened += 1;
      },
      onData() {
        messages += 1;
      },
      onError(error) {
        errors += 1;
        console.error(`[ws ${index}]`, error?.message ?? error);
      },
    },
  );
  subscriptions.push(subscription);
}

console.log(
  `Status-Subscriptions gestartet: ${clients}\n  Code: ${sessionCode}\n  WS: ${wsUrl}\n  Dauer: ${durationMs} ms`,
);

await new Promise((resolve) => setTimeout(resolve, durationMs));

for (const subscription of subscriptions) {
  subscription.unsubscribe();
}
wsClient.close();

console.log('\n— Ergebnis —');
console.log({
  sessionCode,
  wsUrl,
  clients,
  opened,
  messages,
  errors,
  durationMs,
});
