# PRD — Kinetic Type Engine (VJ Tool)

## Original Problem Statement
Tool per visual artist: scrivendo in una text box, il testo viene visualizzato a sinistra e manipolato in tempo reale (stretch, spostamenti, rotazioni), dentro una risoluzione scelta (16:9, 4:3, 1:1…). Il `;` nel testo manda a capo (es. "FEDERICO;BLU" su due righe). Colori di sfondo e testo modificabili, clip video/gif caricabili che si alternano al testo, scelta del font (Google + font di sistema/custom), e output pulito a schermo intero da catturare come sorgente video in Resolume Arena.

## User Choices
- Estetica: sfondo nero, testo bianco (monocromatico).
- Animazioni: sia automatiche (preset) sia controlli manuali.
- Clip: caricate dall'utente dal computer.
- Output: finestra fullscreen pulita per screen-capture in Resolume.
- Font: Google Fonts + upload font personalizzati.

## Architecture
- Frontend: React (CRA/craco), Tailwind, shadcn/ui, framer/CSS transforms via requestAnimationFrame (ref-driven per 60fps).
- Backend: FastAPI + MongoDB (motor) — CRUD scene sotto `/api/scenes`.
- Rendering condiviso: `VisualStage.jsx` usato sia nella preview studio che nella finestra `/output` (sync via BroadcastChannel + localStorage).

## Personas
- VJ / visual artist che genera visual tipografiche live durante eventi, inviando l'output a Resolume Arena/OBS via screen-capture.

## Core Requirements (static)
- Text input con `;` = line break.
- Preview live con selettore aspect ratio.
- Trasformazioni manuali: pos X/Y, scala, stretch X/Y, rotazione, skew, opacità, glow.
- Preset animazioni automatiche: wave, pulse, bounce, glitch, zoom, drift, jitter, blink (con speed/amp).
- Colori testo/sfondo.
- Clip video/gif locali: modalità background / alternate, blend, opacità, velocità, intervallo.
- Font: Google Fonts + upload custom (FontFace API).
- Output fullscreen pulito + pop-out window.
- Scene salvabili/caricabili (MongoDB) + hotkey 1–6 + export JSON.

## Implemented (2026-06)
- ✅ Text engine con parsing `;`, maiuscolo, allineamento, spaziatura, altezza riga, dimensione.
- ✅ Aspect ratios 16:9/4:3/1:1/9:16/21:9 con fit automatico.
- ✅ Pannello trasformazioni completo + reset.
- ✅ 8 preset animazione live con speed/amp.
- ✅ Color picker testo/sfondo + glow + opacità.
- ✅ Media manager: upload clip, background/alternate, blend/opacità/velocità/intervallo.
- ✅ Font: ricerca, lista Google Fonts con anteprima, upload custom.
- ✅ Output fullscreen clean + pop-out `/output` sincronizzato.
- ✅ Scene CRUD backend, hotkey 1–6, export JSON.
- ✅ Testing agent: backend 8/8, frontend 12/12.

## Backlog
- P1: UI edit/rename scene (PUT già disponibile lato backend).
- P1: sync video clip nella finestra pop-out (attualmente le clip blob restano nella finestra principale; per la cattura usare Fullscreen).
- P2: reattività audio reale (microfono/BPM) invece del solo timer.
- P2: per-letter effetti avanzati (mask del testo con video).
- P2: paginazione lista scene.

## Next Tasks
- Aggiungere audio-reactivity e/o BPM tap.
- Text-as-mask per riempire il testo con la clip video.

## Modalità GRID (aggiunta 2026-06)
Motore a griglia generativa BPM-driven ispirato al riferimento "303 MTL PLUGIN".
- Route `/grid` (switch KINETIC/GRID nell'header) + output pulito `/grid-output` e fullscreen.
- ✅ Griglia spezzata generativa (guillotine split, seed-based) con celle che si ricompongono.
- ✅ Contenuto celle: frammenti di testo giganti (verticali quando la cella è alta), media in duotone (mix-blend screen su colore palette), blocco metadati (titolo/sottotitolo/BPM/IDX-###).
- ✅ Palette Nero/Bianco, Blu/Bianco, Rosso/Bianco + Invert + Flip-on-cut.
- ✅ Loop BPM: restructure automatico ogni N beat + flip colori sul cut; Play/Stop, Restructure, Tap tempo, Space=cut, F=fullscreen.
- ✅ Slider BPM, cut-every, complessità (n° celle); editing testo/titolo/sottotitolo; selezione font (Archivo Black default); upload immagini/video.
- ✅ Testing agent: 10/10 flussi GRID passati.
- Nota: i media (blob locali) non passano nella finestra pop-out; per la cattura in Resolume con media usare la modalità Fullscreen (stesso documento).

## GRID v2 — reattività audio, wrap, stabilità (2026-06)
- ✅ **Reattività audio (microfono)**: Web Audio API, rilevamento beat sui bassi → `cut()` a tempo di musica; slider sensibilità + level meter. Disabilita il loop BPM quando attivo.
- ✅ **Celle stabili sul beat**: assegnazione contenuti seedata solo da `topoSeed` (stabile); sul cut cambiano SOLO le dimensioni (ratio morph). Nessuno scambio di celle. Riorganizzazione (nuova topologia) solo su cambio palette / Restructure / complessità.
- ✅ **Invert graduale**: transizione `background-color/color 0.4s ease-in-out` su celle/stage/meta/media.
- ✅ **Ritorno a capo (toggle "A capo")**: split per `;`, frasi multi-parola vanno a capo nella cella con fit binario multi-linea; default = una parola per cella.
- ✅ **Media nelle celle (clip/GIF/immagini)** in duotone (grayscale + mix-blend screen), assegnazione stabile.
- ✅ Testing agent iteration_4: 7/7 checks passati.

## GRID v3 — colori alternati, meta unificata, randomicità, resize progressivo (2026-06)
- ✅ **Colori alternati garantiti**: assegnazione bilanciata ~50% celle accent-bg / celle white-bg (non più tutte uguali).
- ✅ **Meta unificata**: una sola textbox "Testo info (meta)" con `;` = a capo; la cella meta si auto-adatta al riquadro come le altre (rimossi i campi separati sottotitolo/IDX/titolo/BPM).
- ✅ **Slider "Randomicità dimensioni" (1-10)**: controlla lo spread dei rat" tra le celle (mite → forte).
- ✅ **Modalità resize "Progressivo"** (oltre a "Tutte insieme"): sul beat cambia solo un sottoinsieme di celle seguendo il pattern 2 → 3 → tutte; la scelta è biasata verso le celle più piccole (leaf-level) così il "un paio alla volta" è visibile anche con poche celle.
- ✅ Invariante mantenuto: sul beat le celle cambiano solo dimensione, mai posizione/contenuto (reshuffle solo su palette/Restructure/complessità/media).
- ✅ Testing agent iteration_5: 4/4 nuove feature + regressioni al 100%.

## GRID v4 — media in griglia + Pop-out (2026-06)
- ✅ **Bug fix media upload**: gli upload (immagini/GIF/clip) vengono letti come **data URL** (funzionano tra finestre); `assignContent` garantisce almeno una cella media quando ci sono clip; feedback toast all'upload. Le celle media sono rese in **duotone** (grayscale + mix-blend screen).
- ✅ **Media nel Pop-out**: messaggio BroadcastChannel dedicato `media` porta i data URL a `/grid-output` (il broadcast per-beat resta leggero). `GridOutput` ricostruisce gli URL delle clip. Funziona sia aprendo il pop-out prima sia dopo l'upload.
- ✅ Testing agent iteration_6: media in griglia + pop-out (entrambi gli ordini), persistenza sui beat, rimozione clip, regressioni — 100%.

## GRID v5 — colori custom, duotone immagini, fade rotazione, invert random (2026-06)
- ✅ **Doppio color picker RGB** (color1 sfondo + color2 ink) al posto delle palette preset; bottone "Scambia colori".
- ✅ **1 immagine = 1 riquadro**: le clip occupano solo le celle più piccole (una per clip), il testo resta nelle altre; non sostituiscono più tutte le celle.
- ✅ **Duotone immagini via filtro SVG** (feColorMatrix + feComponentTransfer) mappato ai 2 colori scelti; **inversione funziona** senza artefatti (filtri duoA/duoB, niente white-out).
- ✅ **Invert random durante il live**: sul cut il flip avviene solo random (~35%), non ad ogni ciclo.
- ✅ **Fade sulla rotazione**: quando il testo passa orizzontale↔verticale, entra con un leggero fade (`vj-fade`), niente più scatto.
- ✅ **Avviso dimensione clip**: warning oltre 8MB, blocco oltre 40MB.
- ✅ Testing agent iteration_7: 6/6 modifiche + regressioni al 100%.

## GRID v6/v7 (2026-06)
- ✅ Bug "parole sparite": auto-espansione celle (`cellCount = min(24, max(count, tokens+clips+1))`) — ogni parola e ogni clip ha il suo riquadro. KINETIC rimosso (GRID su "/"). Bottone "A capo" rimosso.
- ✅ **Dynamic movement**: respiro continuo dei rettangoli via rAF, svincolato dai BPM (transizioni disattivate in dynamic). Testing iteration_8: 100%.
- ✅ **Font esterni drag&drop** (.ttf/.otf) registrati + sincronizzati al pop-out; **pannello audio 3 bande** (bassi/medi/alti) con meter, intensità per banda, selezione banda reattiva e soglia. Testing iteration_9: 100%.
- ⚠️ **Spout/Syphon**: non emettibile nativamente da browser. Pipeline reale: `/output` (finestra pulita) → OBS Studio + Spout2/Syphon (o NDI) → Resolume Arena.

## KINETIKO v9 — Export MP4 in-app + 3:4 + rebrand (2026-06)
- ✅ **Export MP4 automatico**: dopo lo stop, la clip WebM/VP9 viene transcodificata in **MP4 H.264** (yuv420p, +faststart, dimensioni forzate pari) via **ffmpeg.wasm** (`src/lib/mp4.js`), con toast di avanzamento %. Core servito localmente da `/public/ffmpeg` (no CDN). Fallback a WebM se la conversione fallisce. Validato con PyAV: H.264 1920×1080 yuv420p, durata corretta. File salvati come `kinetiko-<ts>.mp4/.jpg`.
- ✅ **Aspect 3:4**: aggiunto ad `ASPECTS` in `render.js` (ora 16:9, 4:3, 3:4, 1:1, 9:16, 21:9).
- ✅ **Rebrand**: titolo header "POLYTYPE · GRID ENGINE" → **"KINETIKO · GRID VISUAL TOOL"**.

## KINETIKO v8 — Export JPG + registrazione clip (2026-06)
- ✅ **Salva JPG**: pulsante header cattura il frame corrente e lo scarica (`polytype-<ts>.jpg`, JPEG q0.95). Renderer canvas dedicato (`src/lib/capture.js` → `paintScene`) che rispecchia lo stage (celle, testo orizz/vert, wrap, meta, duotone media via mapping luminanza per-pixel). Export a risoluzione `targetDims(aspect)` (long edge ≤1920).
- ✅ **Stretch testo su click** (2026-06): clic su un rettangolo → il testo si deforma per riempire l'intera cella (non centrato), via `<svg preserveAspectRatio="none">` con viewBox = box glifo naturale. Continua a deformarsi mentre il rettangolo cambia (BPM/Dynamic). Multi-select, bordo verde di selezione, pulsante "Azzera stretch", reset lo pulisce. Reso coerente anche in `paintScene` (JPG) con scala non uniforme su canvas. File: `GridStage.jsx` (prop `selected`/`onCellClick`/`stretched`, `measureGlyph`), `GridStudio.jsx` (`selectedCells`, `toggleCell`), `capture.js`. Verificato live + JPG 1920×1080 valido.
- ✅ **Registra clip (solo area grafica)**: toggle Rec/Stop → `getDisplayMedia` (`preferCurrentTab`) + **Region Capture** (`CropTarget.fromElement(grid-stage)` + `track.cropTo`) per ritagliare la cattura al **solo riquadro della griglia**. Output fluido (transizioni CSS, Dynamic movement, video). **Formato WebM/VP9** (`rec.start()` senza timeslice, nessun bitrate forzato): l'MP4 via MediaRecorder produceva file corrotti (frame sfasati, durata `26113:19`), quindi è stato declassato a ultima scelta. Validato con PyAV: VP9 1920×1080, frame decodificati puliti, durata corretta ~5s. Per Resolume/editor che vogliono MP4: convertire il WebM (FFmpeg/HandBrake) o usare il path desktop OBS+Spout/Syphon.

