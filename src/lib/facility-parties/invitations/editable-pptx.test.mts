import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { buildInvitationSnapshot } from "./snapshot.ts";
import {
  buildEditableInvitationPptx,
  editableInvitationFileName,
} from "./editable-pptx.ts";

test("editable invitation download creates four editable invites per letter slide", async () => {
  const content = await buildEditableInvitationPptx({
    snapshot: buildInvitationSnapshot("Minecraft"),
    childName: "Will Maffett",
    childAge: "5",
    dateLabel: "Sunday, September 27, 2026",
    timeLabel: "1:00 PM - 3:00 PM",
    invitationQuantity: 8,
  });

  assert.ok(content.byteLength > 10_000);
  assert.equal(String.fromCharCode(...content.slice(0, 2)), "PK");

  const archive = await JSZip.loadAsync(content);
  const slides = Object.keys(archive.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  assert.equal(slides.length, 2);

  const firstSlide = await archive.file("ppt/slides/slide1.xml")!.async("text");
  assert.equal((firstSlide.match(/Will Maffett/g) ?? []).length, 4);
  assert.equal((firstSlide.match(/IS TURNING 5!/g) ?? []).length, 4);
  assert.equal((firstSlide.match(/Jumping Jax/g) ?? []).length, 4);
});

test("editable invitation filename is safe and recognizable", () => {
  assert.equal(
    editableInvitationFileName("Will Maffett"),
    "will-maffett-editable-invitations.pptx",
  );
});
