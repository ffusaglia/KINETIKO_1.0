// In-app WebM -> MP4 (H.264) transcode via ffmpeg.wasm, so clips are ready for
// Resolume / editors. Core files are served locally from /public/ffmpeg to avoid
// a CDN dependency. The ffmpeg core is lazy-loaded on first use (~32MB wasm).
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg = null;
let loadPromise = null;

async function ensureLoaded() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const inst = new FFmpeg();
    const base = `${process.env.PUBLIC_URL || ""}/ffmpeg`;
    await inst.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.jscore`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpeg = inst;
    return inst;
  })();
  return loadPromise;
}

// Transcode a WebM blob to an MP4 blob. onProgress(0..1) is optional.
export async function webmToMp4(blob, onProgress) {
  const ff = await ensureLoaded();
  const handler = ({ progress }) => { if (onProgress) onProgress(Math.max(0, Math.min(1, progress))); };
  ff.on("progress", handler);
  try {
    await ff.writeFile("in.webm", await fetchFile(blob));
    await ff.exec([
      "-i", "in.webm",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      // H.264 needs even dimensions; force them in case the capture was odd.
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-movflags", "+faststart",
      "out.mp4",
    ]);
    const data = await ff.readFile("out.mp4");
    await ff.deleteFile("in.webm").catch(() => {});
    await ff.deleteFile("out.mp4").catch(() => {});
    return new Blob([data.buffer], { type: "video/mp4" });
  } finally {
    ff.off("progress", handler);
  }
}
