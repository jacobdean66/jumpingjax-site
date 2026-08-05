import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Rental } from "../../data/rentals";
import {
  inventoryRowToRental,
  mergeWebsiteRentals,
} from "./public-catalog";

const staticRentals: Rental[] = [
  {
    id: "bounce-houses/dream-castle",
    slug: "dream-castle",
    categoryId: "bounce-houses",
    title: "Dream Castle",
    shortDescription: "Static short",
    description: "Static full",
    startingPrice: 200,
    imageSrc: "/a.jpg",
    imageAlt: "Dream Castle",
    ageRecommendation: "3+",
    setupRequirements: ["Level ground"],
  },
  {
    id: "combos/world-of-disney",
    slug: "world-of-disney",
    categoryId: "combos",
    title: "World of Disney",
    shortDescription: "Static short",
    description: "Static full",
    startingPrice: 300,
    imageSrc: "/b.jpg",
    imageAlt: "World of Disney",
    ageRecommendation: "3+",
    setupRequirements: ["Level ground"],
  },
];

describe("mergeWebsiteRentals", () => {
  it("keeps static catalog when inventory is empty", () => {
    assert.deepEqual(mergeWebsiteRentals(staticRentals, []), staticRentals);
  });

  it("keeps the static catalog when inventory exists but nothing is approved yet", () => {
    const merged = mergeWebsiteRentals(staticRentals, [
      {
        slug: "dream-castle",
        category_id: "bounce-houses",
        title: "Dream Castle",
        short_description: "Admin short",
        description: "Admin full",
        starting_price: 225,
        image_src: "/admin.jpg",
        image_alt: "Dream Castle",
        age_recommendation: "3+",
        setup_requirements: ["Level ground"],
        public_visible: false,
        is_active: true,
      },
    ]);

    assert.deepEqual(merged, staticRentals);
  });

  it("removes review items from the website once publishing is in use", () => {
    const merged = mergeWebsiteRentals(staticRentals, [
      {
        slug: "dream-castle",
        category_id: "bounce-houses",
        title: "Dream Castle",
        short_description: "Admin short",
        description: "Admin full",
        starting_price: 225,
        image_src: "/admin.jpg",
        image_alt: "Dream Castle",
        age_recommendation: "3+",
        setup_requirements: ["Level ground"],
        public_visible: false,
        is_active: true,
      },
      {
        slug: "world-of-disney",
        category_id: "combos",
        title: "World of Disney",
        short_description: "Approved",
        description: "Approved full",
        starting_price: 300,
        image_src: "/b.jpg",
        image_alt: "World of Disney",
        age_recommendation: "3+",
        setup_requirements: ["Level ground"],
        public_visible: true,
        is_active: true,
      },
    ]);

    assert.equal(merged.some((row) => row.slug === "dream-castle"), false);
    assert.equal(merged.some((row) => row.slug === "world-of-disney"), true);
  });

  it("shows approved inventory items on the website, including brand-new ones", () => {
    const merged = mergeWebsiteRentals(staticRentals, [
      {
        slug: "dream-castle",
        category_id: "bounce-houses",
        title: "Dream Castle Updated",
        short_description: "Approved short",
        description: "Approved full",
        starting_price: 250,
        image_src: "/approved.jpg",
        image_alt: "Dream Castle Updated",
        age_recommendation: "4+",
        setup_requirements: ["Level ground", "Power"],
        public_visible: true,
        is_active: true,
      },
      {
        slug: "brand-new-bouncer",
        category_id: "bounce-houses",
        title: "Brand New Bouncer",
        short_description: "New item",
        description: "New item full",
        starting_price: 175,
        image_src: "/new.jpg",
        image_alt: "Brand New Bouncer",
        age_recommendation: "3+",
        setup_requirements: ["Level ground"],
        public_visible: true,
        is_active: true,
      },
    ]);

    const dream = merged.find((row) => row.slug === "dream-castle");
    const created = merged.find((row) => row.slug === "brand-new-bouncer");

    assert.equal(dream?.title, "Dream Castle Updated");
    assert.equal(dream?.startingPrice, 250);
    assert.equal(created?.title, "Brand New Bouncer");
    assert.equal(merged.some((row) => row.slug === "world-of-disney"), true);
  });

  it("does not publish inactive items even when marked public", () => {
    const merged = mergeWebsiteRentals(staticRentals, [
      {
        slug: "dream-castle",
        category_id: "bounce-houses",
        title: "Dream Castle",
        short_description: "",
        description: "",
        starting_price: 200,
        image_src: "/a.jpg",
        image_alt: "Dream Castle",
        age_recommendation: "",
        setup_requirements: [],
        public_visible: true,
        is_active: false,
      },
      {
        slug: "world-of-disney",
        category_id: "combos",
        title: "World of Disney",
        short_description: "",
        description: "",
        starting_price: 300,
        image_src: "/b.jpg",
        image_alt: "World of Disney",
        age_recommendation: "",
        setup_requirements: [],
        public_visible: true,
        is_active: true,
      },
    ]);

    assert.equal(merged.some((row) => row.slug === "dream-castle"), false);
    assert.equal(merged.some((row) => row.slug === "world-of-disney"), true);
  });
});

describe("inventoryRowToRental", () => {
  it("maps inventory rows into website rental cards", () => {
    const rental = inventoryRowToRental({
      slug: "foam-party",
      category_id: "foam-parties",
      title: "Foam Party",
      short_description: "Short",
      description: "Full",
      starting_price: "350",
      image_src: "/foam.jpg",
      image_alt: "Foam",
      age_recommendation: "5+",
      setup_requirements: ["Water"],
      public_visible: true,
      is_active: true,
    });

    assert.deepEqual(rental, {
      id: "foam-parties/foam-party",
      slug: "foam-party",
      categoryId: "foam-parties",
      title: "Foam Party",
      shortDescription: "Short",
      description: "Full",
      startingPrice: 350,
      imageSrc: "/foam.jpg",
      imageAlt: "Foam",
      ageRecommendation: "5+",
      setupRequirements: ["Water"],
    });
  });
});
