# Grammalecte for Obsidian

French grammar and spell checking inside Obsidian, powered by
[Grammalecte](https://grammalecte.net). Mistakes are underlined while you write;
click one to read the explanation and apply a correction.

> [!WARNING]
> **This plugin is vibecoded.** It was written almost entirely by an AI agent,
> with little to no human review. It may break, lose your place, mangle text
> when applying a suggestion, or do something else entirely. Use it at your own
> risk, on a vault you back up. No warranty, no support, and no responsibility
> is taken for anything that happens to your notes or your machine — see the
> [licence](#licence).

## Features

- Grammar and spelling mistakes underlined directly in the editor: blue for
  grammar, red for spelling.
- Click an underline for Grammalecte's explanation, its suggested corrections,
  and a way to ignore that rule or add the word to your dictionary.
- Checks as you type (debounced), or only when you ask.
- Three interchangeable backends, including one that runs fully offline and on
  mobile.
- Markdown-aware: code, math, link targets and frontmatter are not checked.

## Install

This plugin is not in the community catalogue. Copy `main.js`, `manifest.json`
and `styles.css` into `<vault>/.obsidian/plugins/grammalecte/`, then enable
**Grammalecte** in *Settings → Community plugins*.

To build from source:

```bash
pnpm install
pnpm run build
```

## Choosing a backend

Grammalecte itself is not part of the plugin. Pick where the checking happens in
*Settings → Grammalecte → Grammar checker*; everything else behaves the same.

| Backend | Setup | Where your text goes | Mobile |
| --- | --- | --- | --- |
| **Local server** | Run `grammalecte-server.py` yourself | Stays on your machine | No |
| **Remote server** | A Grammalecte server URL you trust | Sent to that server | Yes |
| **Bundled engine** | One click in settings | Stays on your device | Yes |

### Local server

Download the Grammalecte Python package from
[grammalecte.net](https://grammalecte.net), then start the server:

```bash
python3 grammalecte-server.py -p 8080
```

Set the server URL to `http://localhost:8080` and press **Test** in the
settings — it reports the Grammalecte version when the connection works.

### Remote server

Any host running the same `grammalecte-server.py` works, for example a server of
your own. Your note text is sent to it in full, so only use an instance you
trust. This is the simplest option on mobile.

### Bundled engine (offline)

Choose *Bundled engine* and press **Install / update**. The plugin downloads the
official Grammalecte browser extension from addons.mozilla.org and extracts the
~9 MB of engine and dictionary files it needs into
`<vault>/.obsidian/plugins/grammalecte/engine/`.

Checking then runs inside Obsidian, in a Web Worker, so typing stays responsive.
Nothing leaves your device. The first check after each start takes a moment
while the dictionary loads, and the loaded engine costs roughly 40 MB of heap
(measured on desktop) — on an old phone, a remote server may be the better
trade.

**Remove** deletes the downloaded files again.

## Using it

- Underlines appear as you stop typing. Click one to open the correction menu:
  - a suggestion applies it immediately;
  - **Ignore this rule** silences that Grammalecte rule everywhere;
  - **Add to personal dictionary** silences that word everywhere;
  - **Learn more** opens Grammalecte's explanation page, when the rule has one.
- The ribbon icon (✓) checks the current note on demand.
- The status bar shows the issue count for the current note, `no issue`, or
  `error` — hover it for the reason.

### Commands

| Command | What it does |
| --- | --- |
| **Check the current note** | Runs a check now, and reports connection errors immediately |
| **Clear highlights** | Removes the underlines from the current note |
| **Toggle checking as you type** | Switches between live and on-demand checking |

Assign hotkeys to them in *Settings → Hotkeys*.

## Settings

| Setting | Meaning |
| --- | --- |
| **Grammar checker** | Which backend to use, and its URL or engine install |
| **Check as you type** | Re-check shortly after you stop typing |
| **Typing delay** | How long to wait, 300–5000 ms (default 1200) |
| **Grammar mistakes** | Report grammar errors |
| **Spelling mistakes** | Report unknown words |
| **Ignore Markdown syntax** | Blank out code, math, link targets and frontmatter before checking |
| **Maximum note length** | Characters checked in one pass; longer notes are checked up to this limit and the status bar says `partial` |
| **Personal dictionary** | Words never reported as misspelled, one per line |
| **Ignored rules** | Grammalecte rule ids never reported, one per line |

Rule ids look like `g3__conf_marre_mare__b2_a1_1`; the *Ignore this rule* menu
entry fills this list for you.

## How it works

- The note is read from the editor, Markdown syntax is replaced by spaces (so
  every offset still matches the original text), and the result is sent to the
  chosen backend.
- Grammalecte returns errors with offsets relative to each paragraph; the plugin
  maps them back onto the document and draws them as CodeMirror decorations,
  which follow your edits until the next check.
- If the document changes while a check is in flight, the result is discarded
  rather than applied at stale positions.
- The bundled engine is the official Grammalecte JavaScript build, evaluated in
  a worker with its file loader pointed at data the plugin reads from the vault.

More detail for contributors is in [AGENTS.md](AGENTS.md).

## Development

```bash
pnpm install
pnpm run dev     # watch build into main.js
pnpm run build   # type-check, then production bundle
pnpm run lint
pnpm run test
```

Tests that need a Grammalecte server are skipped unless one is reachable
(`GRAMMALECTE_SERVER` overrides the URL), and the engine tests are skipped until
the engine is installed in `engine/`.

## Credits

Grammalecte is written by Olivier R. and released under the GPL v3. This plugin
only drives it: the engine is downloaded from the official releases and is not
redistributed here.

## Licence

MIT — see [LICENSE](LICENSE). In short: do what you like with it, and it comes
with absolutely no warranty. The author is not liable for any damage, data loss
or other trouble arising from its use.
