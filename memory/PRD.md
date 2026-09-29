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
