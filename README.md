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
| **MonKey Miner** | Mines Banano wallets for rare monKey accessories, fully offline. |
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

## Recovered HTML5 apps (`/apps/`)

`npm run dev` also serves the other apps recovered from `Html5-sync-incoming`,
over the dev server's origin rather than `file://`:

| URL | App |
| --- | --- |
| `/apps/` | Index, with a live secure-context / microphone check |
| `/apps/anc-studio/` | ANC Studio Ultra — adaptive multi-band FxLMS over AudioWorklet |
| `/apps/cyberchef/` | CyberChef Renovated Kitchen — 336 recipes, plus file input and save |
| `/apps/cryptofountain-bbs/` | CryptoFountain BBS — P2P microblogging with erasure codes |

The BBS shipped with a Cloudflare Insights beacon; it has been stripped so the
page is fully self-contained and makes no external requests.

### Why serving them matters

`getUserMedia` is only available in a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts).
A page opened from `file://` is not one, so the browser never offers the
microphone prompt and ANC Studio can't start — nothing in the app is broken.
Served from an `http://localhost` or `https://` origin the prompt appears.
The same applies to the MonKey API: `file://` pages get a `null` origin, which
CORS rejects.

A small Vite middleware (`appsDirectoryIndex` in `vite.config.ts`) rewrites
directory URLs under `/apps/` to their `index.html`, which the SPA fallback
would otherwise swallow.

### CyberChef: file input, byte-exact Base64, save

The kitchen had no file input and no way to save output, and its `To Base64`
operation was `b64FromBytes(utf8Encode(text))` — running bytes through UTF-8,
which corrupts anything that isn't valid UTF-8. Added:

- **📁 Load File** — reads raw bytes. The loaded file (not the textarea)
  becomes the pipeline source, so binary is never re-encoded.
- **File / Binary to Base64** — byte-exact, with optional line wrapping.
  Also **Base64 to File / Binary** and **File / Binary to Data URI**.
- **→ Base64** — one-click recipe: prompts for a file and encodes it.
- **💾 Save Output** — downloads the result. Base64 output is decoded back to
  real bytes, so *File → Base64 → Save* reproduces the original file.

Binary travels the text pipeline as a Latin-1 string (one code unit per byte)
via `binStrFromBytes` / `bytesFromBinStr`. Verified on a 4096-byte adversarial
payload including NULs and `0xFF`: the output equals Node's
`Buffer.toString("base64")` exactly, while the old UTF-8 path does not.

## MonKey Miner

The `🐒 MonKey Miner` tab generates real Banano wallets (`bananocurrency-web`)
and keeps the ones whose monKey wears the accessories you're hunting.

The original build called `monkey.banano.cc/api/v1/monkey/dtl/<address>` for every
candidate, so it needed the network, was rate-limited, and produced no cards at
all offline. Accessories are now derived **locally from the address**, the same
way the real service derives them deterministically.

### Odds are the real ones

Verified against [appditto/MonKey](https://github.com/appditto/MonKey), whose
**code** is MIT:

| Source | What it gives |
| --- | --- |
| `server/image/accessories.go` | category chances — glasses .25, hat .35, misc .3, shirt/pants .25, shoes .22, tail .2, mouth always |
| accessory filenames, `[w-N]` | per-item weights |

`CATEGORY_ODDS` matched the Go constants exactly. The catalog was missing four
accessories (`beanie`, `beanie-long`, `cap-backwards`, `smile-normal`); with those
added it now holds all **68** items and each category's weights sum exactly to
`CATEGORY_TOTAL`, so nothing is unreachable. `test/monkey-catalog.test.tsx` locks
this to the upstream numbers, and `test/monkey-stats.test.ts` mines 300,000
addresses and asserts every accessory lands inside a 4-sigma binomial window.

Sampling draws each category at `CATEGORY_ODDS`, then one item at
`weight / CATEGORY_TOTAL`. A Flamethrower stays 1 in 941 (Epic).

### Artwork: why the official assets are not bundled

**The official monKey artwork cannot be redistributed.** appditto/MonKey splits
its licence: the MIT grant covers code only —

> All code is copyrighted by Appditto LLC under the MIT license.

— while the assets are explicitly excluded, and the LICENCE enumerates all 68
accessory SVGs individually (`flamethrower-[...][w-0.04].svg`, `crown-...`,
`hat-jester-...`, every body part) under:

> The monKey logo, animations, and all assets including those in the "src/static"
> and "server/assets" folders are copyrighted by Appditto LLC and used by
> permission **for this project only**. Use of these assets without express
> written consent from Appditto LLC for any reason is **strictly forbidden**.

Copying them into this repo would breach that, so the miner offers two modes:

| Mode | Behaviour |
| --- | --- |
| **✏️ Offline art** (default) | Deterministic SVG drawn locally from the address hash, showing the accessories it rolled. Not the official art. No network. |
| **🖼 Official art** | Loads the real monKey from `monkey.banano.cc` at runtime — using the public service as intended, redistributing nothing. Falls back to the offline drawing if unreachable. |

Toggle it from the miner header; the choice persists. If you obtain written
consent from Appditto, the swap is `MonkeyAvatar` → composite the real layers.

## Collapsible shell

Everything collapses, and the collapse state persists.

| Control | Desktop (>=1024px) | Narrow |
| --- | --- | --- |
| **☰ hamburger** | toggles the left nav between labels and an icon rail | opens the nav as an off-canvas overlay |
| **📥 Pipe Inbox** | docks a 20rem panel beside the content | opens the inbox as an overlay |
| **Section headers** | collapse individual panels inside each tool | same |

`src/shell/AppShell.tsx` owns the layout; `src/shell/Collapsible.tsx` is the
reusable section. Notes on the details that are easy to get wrong:

- **Collapsed panels are hidden, not unmounted.** Unmounting would discard tool
  state — a half-typed mnemonic, a page of mined MonKeys.
- **Overlays are deliberately not persisted**, unlike the rail and dock. Restoring
  a modal overlay on load would drop the user behind a backdrop. Escape and a
  backdrop click both close them, and body scroll is locked while one is open.
- **The icon rail keeps accessible names** via `title`, so collapsing to icons
  does not strip the nav for screen readers. Toggles expose `aria-expanded` /
  `aria-controls`, and the active tool is marked `aria-current="page"`.

Covered by 13 tests in `src/shell/AppShell.test.tsx` across both breakpoints.

## Layout

```
src/
  shell/
    AppShell.tsx           hamburger, collapsible nav rail, docked inbox
    Collapsible.tsx        reusable collapsing section
    hooks.ts               persisted state, media query, escape, scroll lock
  pipe/
    types.ts               content types, Pipe/Delivery/PipeDraft, MAX_PIPES
    PipeProvider.tsx       store, persistence, delivery queue, usePipeReceiver
    PipeButtons.tsx        PipeOutButton / PipeInButton
    PipeInboxPanel.tsx     inbox contents for the shell sidebar
    PipeProvider.test.tsx  14 regression tests
  lib/
    monkey/                accessory catalog + offline deterministic generation
    wallet.ts              BIP-39/44, 5-7-5 partitioning, mining, AES vault
    syllables.ts           heuristic syllable counter
    enso.ts, rng.ts        ensō rendering + seeded RNG
  components/              tool tabs
test/
  monkey-stats.test.ts     300k-sample rarity distribution check
  monkey-miner.test.ts     address generation + end-to-end mining
public/apps/               recovered HTML5 apps, served over HTTPS
```

## Security

Seeds are generated in the browser for entertainment and education. **Do not store
real funds in them.** The vault is AES-256 encrypted with your Ensō ID, but the
plaintext export writes mnemonics in the clear.
