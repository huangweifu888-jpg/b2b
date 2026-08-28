import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const frontendRoot = resolve(import.meta.dirname, "..");
const sourceDirectory = resolve(frontendRoot, "public/assets/customer-service/reminder-covers/zodiac-250");
const writeOptimizedAssets = process.argv.includes("--write");
const quality = Number.parseFloat(process.env.B2B_REMINDER_COVER_WEBP_QUALITY || "1");
const minimumPsnrDb = 34;
const reportOutput = process.env.B2B_REMINDER_COVER_REPORT
  ? resolve(frontendRoot, process.env.B2B_REMINDER_COVER_REPORT)
  : null;

if (!Number.isFinite(quality) || quality < 0.8 || quality > 1) {
  throw new Error("B2B_REMINDER_COVER_WEBP_QUALITY must be between 0.8 and 1");
}

const pngNames = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".png")
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (pngNames.length !== 12) {
  throw new Error(`Expected 12 code-owned zodiac PNG covers, found ${pngNames.length}`);
}

const browserChannel = process.env.B2B_E2E_CHANNEL || (process.platform === "win32" ? "chrome" : undefined);
const browser = await chromium.launch({ headless: true, channel: browserChannel });
const page = await browser.newPage();
const browserVersion = browser.version();
const files = [];

try {
  for (const pngName of pngNames) {
    const stem = pngName.slice(0, -extname(pngName).length);
    const pngPath = resolve(sourceDirectory, pngName);
    const webpName = `${stem}.webp`;
    const webpPath = resolve(sourceDirectory, webpName);
    const pngBytes = await readFile(pngPath);

    if (writeOptimizedAssets) {
      const encoded = await page.evaluate(async ({ sourceBase64, encoderQuality }) => {
        const sourceResponse = await fetch(`data:image/png;base64,${sourceBase64}`);
        const sourceBitmap = await createImageBitmap(await sourceResponse.blob());
        const canvas = new OffscreenCanvas(sourceBitmap.width, sourceBitmap.height);
        canvas.getContext("2d").drawImage(sourceBitmap, 0, 0);
        const blob = await canvas.convertToBlob({ type: "image/webp", quality: encoderQuality });
        return {
          width: sourceBitmap.width,
          height: sourceBitmap.height,
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        };
      }, { sourceBase64: pngBytes.toString("base64"), encoderQuality: quality });
      if (encoded.width !== 250 || encoded.height !== 250) {
        throw new Error(`${pngName} must stay 250x250, got ${encoded.width}x${encoded.height}`);
      }
      await writeFile(webpPath, Buffer.from(encoded.bytes));
    }

    const webpBytes = await readFile(webpPath);
    const comparison = await page.evaluate(async ({ sourceBase64, optimizedBase64 }) => {
      const decode = async (mimeType, base64) => {
        const response = await fetch(`data:${mimeType};base64,${base64}`);
        return createImageBitmap(await response.blob());
      };
      const sourceBitmap = await decode("image/png", sourceBase64);
      const optimizedBitmap = await decode("image/webp", optimizedBase64);
      if (sourceBitmap.width !== optimizedBitmap.width || sourceBitmap.height !== optimizedBitmap.height) {
        return { width: optimizedBitmap.width, height: optimizedBitmap.height, dimensionMatch: false };
      }
      const sourceCanvas = new OffscreenCanvas(sourceBitmap.width, sourceBitmap.height);
      const optimizedCanvas = new OffscreenCanvas(optimizedBitmap.width, optimizedBitmap.height);
      const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
      const optimizedContext = optimizedCanvas.getContext("2d", { willReadFrequently: true });
      sourceContext.drawImage(sourceBitmap, 0, 0);
      optimizedContext.drawImage(optimizedBitmap, 0, 0);
      const sourcePixels = sourceContext.getImageData(0, 0, sourceBitmap.width, sourceBitmap.height).data;
      const optimizedPixels = optimizedContext.getImageData(0, 0, optimizedBitmap.width, optimizedBitmap.height).data;
      let squaredError = 0;
      let absoluteError = 0;
      let maxAlphaDelta = 0;
      for (let index = 0; index < sourcePixels.length; index += 4) {
        const sourceAlpha = sourcePixels[index + 3] / 255;
        const optimizedAlpha = optimizedPixels[index + 3] / 255;
        for (let channel = 0; channel < 3; channel += 1) {
          const delta = (sourcePixels[index + channel] * sourceAlpha)
            - (optimizedPixels[index + channel] * optimizedAlpha);
          squaredError += delta * delta;
          absoluteError += Math.abs(delta);
        }
        maxAlphaDelta = Math.max(maxAlphaDelta, Math.abs(sourcePixels[index + 3] - optimizedPixels[index + 3]));
      }
      const rgbChannelCount = sourceBitmap.width * sourceBitmap.height * 3;
      const meanSquaredError = squaredError / rgbChannelCount;
      const psnrDb = meanSquaredError === 0 ? 99 : 10 * Math.log10((255 * 255) / meanSquaredError);
      return {
        width: optimizedBitmap.width,
        height: optimizedBitmap.height,
        dimensionMatch: true,
        meanAbsoluteError: absoluteError / rgbChannelCount,
        psnrDb,
        maxAlphaDelta,
      };
    }, {
      sourceBase64: pngBytes.toString("base64"),
      optimizedBase64: webpBytes.toString("base64"),
    });

    if (!comparison.dimensionMatch || comparison.width !== 250 || comparison.height !== 250) {
      throw new Error(`${webpName} does not preserve the 250x250 dimensions`);
    }
    if (comparison.psnrDb < minimumPsnrDb || comparison.meanAbsoluteError > 4 || comparison.maxAlphaDelta > 1) {
      throw new Error(`${webpName} visual quality failed: ${JSON.stringify(comparison)}`);
    }

    files.push({
      png: pngName,
      webp: webpName,
      beforeBytes: pngBytes.length,
      afterBytes: webpBytes.length,
      reductionPercent: Number((((pngBytes.length - webpBytes.length) / pngBytes.length) * 100).toFixed(1)),
      width: comparison.width,
      height: comparison.height,
      psnrDb: Number(comparison.psnrDb.toFixed(2)),
      meanAbsoluteError: Number(comparison.meanAbsoluteError.toFixed(3)),
      maxAlphaDelta: comparison.maxAlphaDelta,
    });
  }
} finally {
  await browser.close();
}

const totalBeforeBytes = files.reduce((total, file) => total + file.beforeBytes, 0);
const totalAfterBytes = files.reduce((total, file) => total + file.afterBytes, 0);
const report = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  mode: writeOptimizedAssets ? "write-and-verify" : "verify",
  sourceDirectory: sourceDirectory.replaceAll("\\", "/"),
  encoder: `Chromium ${browserVersion} OffscreenCanvas image/webp`,
  quality,
  thresholds: { dimensions: "250x250", minimumPsnrDb, maximumMeanAbsoluteError: 4, maximumAlphaDelta: 1 },
  totalBeforeBytes,
  totalAfterBytes,
  savedBytes: totalBeforeBytes - totalAfterBytes,
  reductionPercent: Number((((totalBeforeBytes - totalAfterBytes) / totalBeforeBytes) * 100).toFixed(1)),
  files,
};

if (reportOutput) {
  await mkdir(dirname(reportOutput), { recursive: true });
  await writeFile(reportOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

const missingFiles = await Promise.all(files.map(async (file) => {
  const path = resolve(sourceDirectory, file.webp);
  try {
    return (await stat(path)).isFile() ? null : file.webp;
  } catch {
    return file.webp;
  }
}));
if (missingFiles.some(Boolean)) throw new Error(`Missing optimized covers: ${missingFiles.filter(Boolean).join(", ")}`);

console.log(JSON.stringify(report, null, 2));
