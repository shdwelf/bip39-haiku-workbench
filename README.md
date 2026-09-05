# bip39-haiku-workbench

Offline workbench for mining **BIP-39 mnemonics that scan as 5-7-5 haiku**, deriving
their BIP-44 addresses, and moving data between tools through a **piped inbox**.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # pipe inbox test suite
npm run build   # single-file offline bundle -> dist/index.html
```

The production build is inlined by `vite-plugin-singlefile`, so `dist/index.html`
runs standalone from the filesystem with no server and no network.

## Provenance

This repository was empty apart from a README. The application source was recovered
from the archive repo [`shdwelf/Html5-sync-incoming`](https://github.com/shdwelf/Html5-sync-incoming):

| Piece | Recovered from |
| --- | --- |
| Workbench app (React + Vite + Tailwind, `src/lib/wallet.ts`, `src/lib/syllables.ts`, `src/lib/enso.ts`) | `build-bip-39-haiku-wallet.zip` |
| Piped inbox concept and UI | `hyper-portal-2.27.0-PIPED-installer.html` (inside `Internal storage.7z`) |

The two never shipped together: the haiku workbench had no inbox, and the
hyper-portal build that had the inbox had no haiku tool. Wiring them together —
and repairing the inbox on the way — is what this repo does.

## Tools

| Tab | Purpose |
| --- | --- |
| **Ensō Forge** | Parameterised ensō brushstroke; its packed *Ensō ID* doubles as the vault password. |
| **Haiku Wallet** | Mines 128-bit mnemonics until the 12 words partition into 5-7-5, derives `m/44'/0'/0'/0/0`, stores them in an AES-256 vault. |
| **Inspector** | Validates a phrase's BIP-39 checksum, shows its syllable/5-7-5 breakdown, derives address + xpub. |
| Terminal / wAves / Market | Carried over from the original build. |

## The piped inbox

Any tool can **park** a value in the inbox (`📤 Pipe`) or **pull** one out
(`📥 Pull from Pipe`). The floating inbox can also **push** a value straight into
a tool, which focuses that tab and delivers the payload.

Content is typed (`mnemonic`, `haiku`, `address`, `xpub`, `json`, `text`) and the
UI only offers targets that accept the type — so a mnemonic mined in the wallet
can be sent to the Inspector, but an address cannot.

### What was broken

The original provider (`hyper-portal-2.27.0-PIPED-installer.html`) kept a single
`inboundPayload` slot and no persistence. Four concrete defects, each now covered
by a regression test in `src/pipe/PipeProvider.test.tsx`:

1. **Back-to-back sends lost data.** Delivery was one `useState` slot, so
   `sendToTool(a); sendToTool(b)` overwrote `a` before any consumer ran — only
   `b` arrived. Deliveries are now an append-only queue drained per tool.

2. **The inbox did not survive a reload.** Pipes lived only in React state, which
   makes "park this for later" meaningless across a refresh. Pipes and in-flight
   deliveries now persist to `localStorage`, with corrupt/quota-limited storage
   degrading to memory instead of throwing.

3. **Empty content read back as a miss.** `consumePipe` ended in
   `?.content || null`, so an empty string — legitimate payload — was
   indistinguishable from a missing pipe. Now `?? null`.

4. **Colliding ids.** Ids came from `Math.random().toString(36).substring(2,10)`.
   Since rows are keyed by id and `removePipe` filters on it, a collision deletes
   the wrong entry. Now `crypto.randomUUID()` with a timestamped fallback.

Additionally, consumption used to be an impure read (`consumeInbound` returned the
payload *and* cleared it), which is fragile under React StrictMode's double-invoked
effects. Delivery is now explicit: `usePipeReceiver` hands the payload to a handler,
records the delivery id in a ref, and acks it — so a repeated effect run cannot
apply the same payload twice.

I verified 1, 3 and 4 by running the new tests against a faithful replica of the
original provider and watching them fail. Defect 2 is likewise reproduced. The
late-mount guarantee (a delivery waits for a tool that has not been opened yet) is
hardening rather than a reproduced regression — the old code happened to survive
that case.

### Using it in a tool

```tsx
// produce
<PipeOutButton draft={{
  content: item.mnemonic, contentType: "mnemonic",
  sourceId: "wallet", sourceName: "Haiku Wallet", label: `${item.id} mnemonic`,
}} />

// consume: pushed deliveries
usePipeReceiver("inspector", (delivery) => setText(delivery.content));

// consume: user-initiated pull
<PipeInButton accepts={["mnemonic", "text"]} onReceive={(content) => setText(content)} />
```

## Layout

```
src/
  pipe/
    types.ts               content types, Pipe/Delivery/PipeDraft, MAX_PIPES
    PipeProvider.tsx       store, persistence, delivery queue, usePipeReceiver
    PipeButtons.tsx        PipeOutButton / PipeInButton
    PipeInbox.tsx          floating inbox drawer
    PipeProvider.test.tsx  14 regression tests
  lib/
    wallet.ts              BIP-39/44, 5-7-5 partitioning, mining, AES vault
    syllables.ts           heuristic syllable counter
    enso.ts, rng.ts        ensō rendering + seeded RNG
  components/              tool tabs
```

## Security

Seeds are generated in the browser for entertainment and education. **Do not store
real funds in them.** The vault is AES-256 encrypted with your Ensō ID, but the
plaintext export writes mnemonics in the clear.
