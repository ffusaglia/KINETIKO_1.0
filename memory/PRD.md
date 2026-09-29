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
