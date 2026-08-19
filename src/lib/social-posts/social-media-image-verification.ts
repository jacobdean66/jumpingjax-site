import "server-only";

import {
  mergeContentSignals,
  resolveVerificationTarget,
  verifyImageDimensionsAgainstVariant,
  type SocialMediaImageContentSignals,
  type SocialMediaImageVerificationResult,
} from "./social-media-image-verification-core";
import { validatedRemoteMediaUrl } from "./social-media-storage";

export type {
  SocialMediaImageContentSignals,
  SocialMediaImageVerificationCode,
  SocialMediaImageVerificationIssue,
  SocialMediaImageVerificationResult,
} from "./social-media-image-verification-core";

export {
  formatActualAspectRatio,
  mergeContentSignals,
  parseAspectRatioString,
  resolveVerificationTarget,
  verifyImageDimensionsAgainstVariant,
} from "./social-media-image-verification-core";

type SharpFactory = (typeof import("sharp"))["default"];

async function loadSharp(): Promise<SharpFactory | null> {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default;
  } catch {
    return null;
  }
}

export async function analyzeImageContentSignals(
  imageUrl: string,
): Promise<SocialMediaImageContentSignals | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;

  const response = await fetch(validatedRemoteMediaUrl(imageUrl), {
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .resize(96, 96, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data.length;
  if (pixels === 0 || info.width <= 0 || info.height <= 0) {
    return null;
  }

  let sum = 0;
  let sumSquares = 0;
  for (let index = 0; index < pixels; index += 1) {
    const value = data[index] ?? 0;
    sum += value;
    sumSquares += value * value;
  }

  const mean = sum / pixels;
  const variance = Math.max(0, sumSquares / pixels - mean * mean);
  const luminanceStdDev = Math.sqrt(variance);

  const width = info.width;
  const height = info.height;
  const bandHeight = Math.max(1, Math.floor(height * 0.15));
  const centerStart = Math.floor(height * 0.35);
  const centerEnd = Math.min(height, centerStart + Math.max(1, Math.floor(height * 0.3)));

  function bandStats(startRow: number, endRow: number): { mean: number; stdDev: number } {
    let bandSum = 0;
    let bandSquares = 0;
    let count = 0;
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const value = data[row * width + col] ?? 0;
        bandSum += value;
        bandSquares += value * value;
        count += 1;
      }
    }
    if (count === 0) return { mean: 0, stdDev: 0 };
    const bandMean = bandSum / count;
    const bandVariance = Math.max(0, bandSquares / count - bandMean * bandMean);
    return { mean: bandMean, stdDev: Math.sqrt(bandVariance) };
  }

  const top = bandStats(0, bandHeight);
  const bottom = bandStats(height - bandHeight, height);
  const center = bandStats(centerStart, centerEnd);

  const likelyBlankOrSolid = luminanceStdDev < 12;
  const likelyLetterboxed =
    luminanceStdDev >= 12 &&
    center.stdDev > 18 &&
    top.stdDev < 10 &&
    bottom.stdDev < 10 &&
    top.mean > 220 &&
    bottom.mean > 220;

  return {
    luminanceMean: mean,
    luminanceStdDev,
    likelyBlankOrSolid,
    likelyLetterboxed,
  };
}

export async function verifySocialMediaImageFromUrl(input: {
  imageUrl: string;
  placement?: string | null;
  formatVariantId?: string | null;
  platforms: readonly string[];
}): Promise<SocialMediaImageVerificationResult> {
  const target = resolveVerificationTarget(input);
  const sharp = await loadSharp();

  if (!sharp) {
    return {
      ok: false,
      width: 0,
      height: 0,
      actualAspectRatio: "unknown",
      expectedVariant: target.variant,
      issues: [
        {
          code: "dimensions_unknown",
          severity: "warning",
          message: "Image verification unavailable — sharp is not installed in this runtime.",
        },
      ],
      contentSignals: null,
      platformCrops: [],
    };
  }

  let response: Response;
  try {
    response = await fetch(validatedRemoteMediaUrl(input.imageUrl), {
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    return {
      ok: false,
      width: 0,
      height: 0,
      actualAspectRatio: "unknown",
      expectedVariant: target.variant,
      issues: [
        {
          code: "image_unreachable",
          severity: "error",
          message: "Generated image URL could not be fetched for verification.",
        },
      ],
      contentSignals: null,
      platformCrops: [],
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      width: 0,
      height: 0,
      actualAspectRatio: "unknown",
      expectedVariant: target.variant,
      issues: [
        {
          code: "image_unreachable",
          severity: "error",
          message: `Generated image URL returned HTTP ${response.status}.`,
        },
      ],
      contentSignals: null,
      platformCrops: [],
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    return {
      ok: false,
      width: 0,
      height: 0,
      actualAspectRatio: "unknown",
      expectedVariant: target.variant,
      issues: [
        {
          code: "dimensions_unknown",
          severity: "error",
          message: "Could not read image dimensions from the generated file.",
        },
      ],
      contentSignals: null,
      platformCrops: [],
    };
  }

  const dimensionResult = verifyImageDimensionsAgainstVariant({
    width,
    height,
    variant: target.variant,
    platforms: input.platforms,
    placement: target.placement,
  });

  const contentSignals = await analyzeImageContentSignals(input.imageUrl);
  return contentSignals
    ? mergeContentSignals(dimensionResult, contentSignals)
    : dimensionResult;
}
