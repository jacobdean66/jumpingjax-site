import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describePreferenceForPreview,
  preferencePromptBlock,
  validateCreativePreferenceFields,
  type CreativePreference,
} from "./creative-preferences.ts";

describe("creative preferences", () => {
  it("requires a natural-language note and builds a preview", () => {
    assert.throws(() =>
      validateCreativePreferenceFields({ naturalLanguageNote: "  " }),
    );
    const fields = validateCreativePreferenceFields({
      naturalLanguageNote: "The child is too large compared with the inflatable.",
      subjectScale: "smaller child relative to inflatable",
      appliesTo: "image",
    });
    const preview = describePreferenceForPreview(fields);
    assert.match(preview, /child is too large/i);
    assert.match(preview, /Subject scale/i);
    assert.match(preview, /Applies to: image/);
  });

  it("formats active preferences for prompts and skips inactive or unrelated", () => {
    const prefs: CreativePreference[] = [
      {
        id: "1",
        title: "Scale",
        naturalLanguageNote: "Keep children smaller than the inflatable.",
        subjectScale: "child smaller than product",
        ageRange: "3-7",
        composition: "",
        cameraAngle: "",
        productVisibility: "entrance visible",
        realism: "",
        brandStyle: "",
        prohibitedElements: "do not cover entrance",
        preferredElements: "",
        appliesTo: "image",
        isActive: true,
        createdBy: "owner",
        createdAt: null,
        updatedAt: null,
      },
      {
        id: "2",
        title: "Caption only",
        naturalLanguageNote: "Keep captions short.",
        subjectScale: "",
        ageRange: "",
        composition: "",
        cameraAngle: "",
        productVisibility: "",
        realism: "",
        brandStyle: "",
        prohibitedElements: "",
        preferredElements: "",
        appliesTo: "caption",
        isActive: true,
        createdBy: "owner",
        createdAt: null,
        updatedAt: null,
      },
      {
        id: "3",
        title: "Inactive",
        naturalLanguageNote: "Ignore me.",
        subjectScale: "",
        ageRange: "",
        composition: "",
        cameraAngle: "",
        productVisibility: "",
        realism: "",
        brandStyle: "",
        prohibitedElements: "",
        preferredElements: "",
        appliesTo: "all",
        isActive: false,
        createdBy: "owner",
        createdAt: null,
        updatedAt: null,
      },
    ];
    const block = preferencePromptBlock(prefs, "image");
    assert.match(block, /Keep children smaller/);
    assert.doesNotMatch(block, /Keep captions short/);
    assert.doesNotMatch(block, /Ignore me/);
  });
});
