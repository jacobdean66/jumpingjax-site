import assert from "node:assert/strict";
import test from "node:test";

import {
  createJsonLdScript,
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateProductSchema,
  generateServiceSchema,
} from "../metadata";

test("structured data uses canonical Jumping Jax URLs", () => {
  const service = generateServiceSchema(
    "Inflatable Rentals",
    "Bounce houses and water slides delivered around Greenwood, SC.",
    "/rentals",
    "Inflatable rental service",
  );
  assert.equal(service.url, "https://jumpingjaxllc.com/rentals");
  assert.equal(service.provider["@id"], "https://jumpingjaxllc.com/#business");

  const breadcrumbs = generateBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Rentals", path: "/rentals" },
  ]);
  assert.equal(
    breadcrumbs.itemListElement[0]?.item,
    "https://jumpingjaxllc.com/",
  );
  assert.equal(
    breadcrumbs.itemListElement[1]?.item,
    "https://jumpingjaxllc.com/rentals",
  );

  const itemList = generateItemListSchema(
    "Water Slides",
    "Water slide rentals in Greenwood, SC.",
    "/rentals/water-slides",
    [
      {
        name: "18' Basic Waterslide",
        path: "/rentals/water-slides/18-ft-basic-waterslide",
        image: "/inflatables/waterslides/legacy/18-ft-basic-waterslide.jpg",
      },
    ],
  );
  assert.equal(itemList.itemListElement[0]?.position, 1);
  assert.equal(
    itemList.itemListElement[0]?.url,
    "https://jumpingjaxllc.com/rentals/water-slides/18-ft-basic-waterslide",
  );
});

test("rental product JSON-LD exposes offer and seller data", () => {
  const product = generateProductSchema(
    "18' Basic Waterslide",
    "Classic backyard water slide rental.",
    325,
    "/inflatables/waterslides/legacy/18-ft-basic-waterslide.jpg",
    "/rentals/water-slides/18-ft-basic-waterslide",
    "Water Slides",
  );

  assert.equal(
    product["@id"],
    "https://jumpingjaxllc.com/rentals/water-slides/18-ft-basic-waterslide#product",
  );
  assert.equal(product.offers?.price, "325");
  assert.equal(product.offers?.seller["@id"], "https://jumpingjaxllc.com/#business");
  assert.match(createJsonLdScript(product).__html, /18' Basic Waterslide/);
});
