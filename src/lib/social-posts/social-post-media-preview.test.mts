import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SOCIAL_POST_MEDIA_PREVIEW_COPY,
  resolvePublicMediaUrl,
  resolveSocialPostMediaPreviewState,
} from "./social-post-media-preview";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_SOURCE = readFileSync(
  `${DIRECTORY}../../app/admin/social-posts/SocialPostsAdminClient.tsx`,
  "utf8",
);
const CONSOLE_SOURCE = readFileSync(
  `${DIRECTORY}../../app/admin/social-posts/DirectorsConsole.tsx`,
  "utf8",
);
const THEME_SOURCE = readFileSync(
  `${DIRECTORY}../../app/admin/social-posts/social-posts-theme.css`,
  "utf8",
);

test("resolvePublicMediaUrl keeps absolute http(s) URLs and roots relative paths", () => {
  assert.equal(
    resolvePublicMediaUrl("https://cdn.example.com/video.mp4"),
    "https://cdn.example.com/video.mp4",
  );
  assert.equal(
    resolvePublicMediaUrl("/inflatables/castle.webp", "https://jumpingjaxllc.com"),
    "https://jumpingjaxllc.com/inflatables/castle.webp",
  );
  assert.equal(resolvePublicMediaUrl("not-a-url"), null);
  assert.equal(resolvePublicMediaUrl("   "), null);
});

test("generated video URL resolves to video_ready with poster when available", () => {
  const state = resolveSocialPostMediaPreviewState({
    media_type: "video",
    media_url: "https://cdn.example.com/output.mp4",
    source_image_url: "https://cdn.example.com/poster.jpg",
    prompt: "Make a backyard promo",
  });

  assert.deepEqual(state, {
    kind: "video_ready",
    mediaUrl: "https://cdn.example.com/output.mp4",
    posterUrl: "https://cdn.example.com/poster.jpg",
  });
});

test("prompt plus source image but no video resolves to video concept", () => {
  const state = resolveSocialPostMediaPreviewState({
    media_type: "video",
    media_url: null,
    source_image_url: "https://jumpingjaxllc.com/inflatables/slide.jpg",
    prompt: "Create a short upbeat promotional video",
  });

  assert.equal(state.kind, "video_concept");
  if (state.kind !== "video_concept") return;
  assert.equal(state.posterUrl, "https://jumpingjaxllc.com/inflatables/slide.jpg");
  assert.equal(state.hasPrompt, true);
  assert.equal(
    SOCIAL_POST_MEDIA_PREVIEW_COPY.videoConcept,
    "Video concept — not generated yet",
  );
});

test("video with neither media URL nor source image is explicitly missing", () => {
  const state = resolveSocialPostMediaPreviewState({
    media_type: "video",
    media_url: null,
    source_image_url: null,
    prompt: null,
  });
  assert.deepEqual(state, { kind: "video_missing" });
  assert.equal(
    SOCIAL_POST_MEDIA_PREVIEW_COPY.videoMissing,
    "No video media attached",
  );
});

test("image URL resolves to image preview state", () => {
  const state = resolveSocialPostMediaPreviewState({
    media_type: "image",
    media_url: "https://cdn.example.com/ad.jpg",
  });
  assert.deepEqual(state, {
    kind: "image_ready",
    mediaUrl: "https://cdn.example.com/ad.jpg",
  });
});

test("image without media URL is explicitly missing", () => {
  const state = resolveSocialPostMediaPreviewState({
    media_type: "image",
    media_url: null,
    source_image_url: "https://cdn.example.com/ignored-for-image.jpg",
  });
  assert.deepEqual(state, { kind: "image_missing" });
  assert.equal(SOCIAL_POST_MEDIA_PREVIEW_COPY.imageMissing, "No media attached");
});

test("MediaPreview no longer collapses every empty media_url into generic No media", () => {
  assert.match(CLIENT_SOURCE, /resolveSocialPostMediaPreviewState/);
  assert.match(CLIENT_SOURCE, /SOCIAL_POST_MEDIA_PREVIEW_COPY\.videoConcept/);
  assert.match(CLIENT_SOURCE, /SOCIAL_POST_MEDIA_PREVIEW_COPY\.videoLoadError/);
  assert.match(CLIENT_SOURCE, /SOCIAL_POST_MEDIA_PREVIEW_COPY\.videoMissing/);
  assert.match(CLIENT_SOURCE, /SOCIAL_POST_MEDIA_PREVIEW_COPY\.imageMissing/);
  assert.match(CLIENT_SOURCE, /playsInline/);
  assert.match(CLIENT_SOURCE, /preload=["']metadata["']/);
  assert.match(CLIENT_SOURCE, /poster=\{preview\.posterUrl/);
  assert.match(CLIENT_SOURCE, /setVideoFailed\(true\)/);
  assert.match(CLIENT_SOURCE, /Retry preview/);
  assert.doesNotMatch(CLIENT_SOURCE, />\s*No media\s*</);
});

test("Director's Console Show/Hide control uses theme-readable interactive styling", () => {
  assert.match(CONSOLE_SOURCE, /Director&apos;s Console|Director's Console/);
  assert.match(CONSOLE_SOURCE, /\{expanded \? "Hide" : "Show"\}/);
  assert.match(CONSOLE_SOURCE, /aria-expanded=\{expanded\}/);
  assert.match(CONSOLE_SOURCE, /sp-directors-console/);
  assert.match(THEME_SOURCE, /\.sp-directors-console/);
  assert.match(THEME_SOURCE, /bg-violet-50/);
});
