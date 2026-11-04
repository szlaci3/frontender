import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import {
  AGENT,
  generateStyle,
  extractOutputText,
  GenerationError,
} from "../vendor/border/server/generation.ts";
import { initial } from "../vendor/border/shared/border.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
let image: string;
let expectedCrop: { x: number; y: number; width: number; height: number };
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 640 },
    deviceScaleFactor: 1,
  });
  const source = `data:image/svg+xml;base64,${readFileSync("public/samples/tile.svg").toString("base64")}`;
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; } body { margin:0; background:#efeee8; color:#254d45; font-family:Arial,sans-serif; }
    header { position:absolute; left:75px; top:45px; font-size:18px; letter-spacing:3px; }
    .frame { position:absolute; left:180px; top:180px; width:640px; height:320px;
      border:32px solid transparent; border-image:url("${source}") 25% / 32px / 0 round;
      background:#fffaf0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    h1 { font:42px Georgia,serif; margin:0 0 20px; } p { font-size:16px; margin:0; }
    footer { position:absolute; left:75px; bottom:40px; color:#6f7e72; font-size:13px; }
    </style></head><body><header>THE SLOW STUDIO</header><main class="frame"><h1>A summer worth keeping.</h1><p>Objects, stories, and a little room for detail.</p></main><footer>A simple website sketch · one decorative frame</footer></body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const img = new Image();
    img.src = getComputedStyle(
      document.querySelector(".frame")!,
    ).borderImageSource.slice(5, -2);
    await img.decode();
  });
  const box = await page.locator(".frame").boundingBox();
  if (!box) throw new Error("Reference frame did not render.");
  expectedCrop = {
    x: box.x / 10,
    y: box.y / 6.4,
    width: box.width / 10,
    height: box.height / 6.4,
  };
  const png = await page.screenshot({
    path: "test-results/sketch-reference.png",
  });
  image = `data:image/png;base64,${png.toString("base64")}`;
} finally {
  await browser.close();
}

let providerCalls = 0;
let providerDiagnostics: object | undefined;
const started = Date.now();
try {
  const result = await generateStyle(
    {
      action: "analyze",
      image,
      settings: initial,
      question:
        "Find the decorative rectangular frame in this website sketch. Crop its complete outer border, excluding surrounding website content, and suggest three border-image settings for the resulting cropped asset.",
      history: [],
      view: {
        shape: "wide",
        background: "paper",
        label: "A summer worth keeping.",
        sourceWidth: 1000,
        sourceHeight: 640,
      },
    },
    {
      fetcher: async (...args: Parameters<typeof fetch>) => {
        providerCalls++;
        if (providerCalls !== 1)
          throw new Error("Only one provider call is authorized.");
        const response = await fetch(...args);
        // Keep only the final model output for this non-private sample, redacting
        // credentials. This avoids losing diagnostic evidence on validation failure.
        try {
          const envelope = await response.clone().json();
          let output = extractOutputText(envelope) ?? "";
          const key = process.env.GEMINI_API_KEY;
          if (key) output = output.split(key).join("[REDACTED]");
          output = output.replace(/AIza[\w-]+/g, "[REDACTED]").slice(0, 50_000);
          providerDiagnostics = {
            httpStatus: response.status,
            status:
              typeof envelope.status === "string"
                ? envelope.status.slice(0, 50)
                : null,
            agentConfirmed: envelope.agent === AGENT,
            output,
          };
        } catch {
          providerDiagnostics = {
            httpStatus: response.status,
            envelopeReadable: false,
          };
        }
        return response;
      },
    },
  );
  writeFileSync(
    "test-results/ai-sketch-probe.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        agent: AGENT,
        outcome: "accepted",
        action: "analyze",
        providerCalls,
        elapsedMs: Date.now() - started,
        inputImage: "sketch-reference.png",
        expectedCrop,
        result,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      ok: true,
      providerCalls,
      elapsedMs: Date.now() - started,
      expectedCrop,
      proposedCrop: result.crop,
      suggestions: result.suggestions?.length,
    }),
  );
} catch (error) {
  writeFileSync(
    "test-results/ai-sketch-probe.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        agent: AGENT,
        action: "analyze",
        providerCalls,
        outcome: "rejected",
        elapsedMs: Date.now() - started,
        applicationStatus:
          error instanceof GenerationError ? error.status : 502,
        error: error instanceof Error ? error.message : "Probe failed.",
        inputImage: "sketch-reference.png",
        expectedCrop,
        providerDiagnostics,
      },
      null,
      2,
    ),
  );
  console.error(
    JSON.stringify({
      ok: false,
      providerCalls,
      error: error instanceof Error ? error.message : "Probe failed.",
    }),
  );
  process.exitCode = 1;
}
