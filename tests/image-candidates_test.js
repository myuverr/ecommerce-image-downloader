import {
  deepStrictEqual as assertEquals,
  throws as assertThrows,
} from "node:assert/strict";
import {
  assertAllowedImageUrl,
  normalizeImageCandidates,
} from "../extension/src/image-candidates.js";

const pageUrl = "https://page.example.test/item/1";
const allowedOrigins = [
  "https://page.example.test",
  "https://img.example.test",
];

Deno.test("normalizeImageCandidatesParsesSrcsetAndDeduplicates", () => {
  const images = normalizeImageCandidates(
    [
      { kind: "url", value: "/front.jpg", alt: "front", width: 600, height: 600 },
      {
        kind: "srcset",
        value:
          "https://img.example.test/front.jpg 1x, https://img.example.test/side.jpg 2x",
        alt: "product",
      },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images.map((image) => image.url), [
    "https://page.example.test/front.jpg",
    "https://img.example.test/front.jpg",
    "https://img.example.test/side.jpg",
  ]);
});

Deno.test("normalizeImageCandidatesResolvesRelativeAndProtocolRelative", () => {
  const images = normalizeImageCandidates(
    [
      { kind: "url", value: "/a.jpg" },
      { kind: "url", value: "//img.example.test/b.jpg" },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images.map((image) => image.url), [
    "https://page.example.test/a.jpg",
    "https://img.example.test/b.jpg",
  ]);
});

Deno.test("normalizeImageCandidatesRejectsUnsafeOrigins", () => {
  const images = normalizeImageCandidates(
    [
      { kind: "url", value: "javascript:alert(1)" },
      { kind: "url", value: "data:image/png;base64,AA==" },
      { kind: "url", value: "https://[::1" },
      { kind: "url", value: "http://img.example.test/a.jpg" },
      { kind: "url", value: "https://other.example.test/a.jpg" },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images, []);
});

Deno.test("assertAllowedImageUrlAcceptsOnlyBoundedHttpsOrigins", () => {
  assertEquals(
    assertAllowedImageUrl("https://img.example.test/a.jpg", allowedOrigins),
    "https://img.example.test/a.jpg",
  );
  assertThrows(() =>
    assertAllowedImageUrl("http://img.example.test/a.jpg", allowedOrigins)
  );
  assertThrows(() =>
    assertAllowedImageUrl(
      "https://other.example.test/a.jpg",
      allowedOrigins,
    )
  );
  assertThrows(() =>
    assertAllowedImageUrl(
      `https://img.example.test/${"a".repeat(2048)}.jpg`,
      allowedOrigins,
    )
  );
});

Deno.test("normalizeImageCandidatesCapsInputAndOutput", () => {
  const candidates = Array.from({ length: 301 }, (_, index) => ({
    kind: "url",
    value: `https://img.example.test/${index}.jpg`,
  }));
  const images = normalizeImageCandidates(candidates, pageUrl, allowedOrigins);

  assertEquals(images.length, 80);
  assertEquals(images[0].id, "image-001");
  assertEquals(images[79].id, "image-080");
});

Deno.test("normalizeImageCandidatesFiltersKnownSmallImages", () => {
  const images = normalizeImageCandidates(
    [
      {
        kind: "url",
        value: "https://img.example.test/small.jpg",
        width: 48,
        height: 200,
      },
      {
        kind: "url",
        value: "https://img.example.test/unknown.jpg",
        width: null,
        height: null,
      },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images.map((image) => image.url), [
    "https://img.example.test/unknown.jpg",
  ]);
});

Deno.test("normalizeImageCandidatesRejectsCredentials", () => {
  const images = normalizeImageCandidates(
    [
      {
        kind: "url",
        value: "https://user:secret@img.example.test/private.jpg",
      },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images, []);
  assertThrows(() =>
    assertAllowedImageUrl(
      "https://user:secret@img.example.test/private.jpg",
      allowedOrigins,
    )
  );
});

Deno.test("normalizeImageCandidatesSkipsNonStringAndMalformedCandidates", () => {
  const images = normalizeImageCandidates(
    [
      null,
      {},
      { kind: "image", value: "https://img.example.test/wrong-kind.jpg" },
      { kind: "url", value: 42 },
      { kind: "url", value: "https://img.example.test/valid.jpg" },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images.map((image) => image.url), [
    "https://img.example.test/valid.jpg",
  ]);
});

Deno.test("normalizeImageCandidatesParsesQueryCommaInSrcset", () => {
  const images = normalizeImageCandidates(
    [
      {
        kind: "srcset",
        value:
          "https://img.example.test/a.jpg?variant=front,large 1x, https://img.example.test/b.jpg 2x",
      },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images.map((image) => image.url), [
    "https://img.example.test/a.jpg?variant=front,large",
    "https://img.example.test/b.jpg",
  ]);
});

Deno.test("normalizeImageCandidatesRejectsKnownSmallSideWhenOtherUnknown", () => {
  const images = normalizeImageCandidates(
    [
      {
        kind: "url",
        value: "https://img.example.test/small-width.jpg",
        width: 48,
        height: null,
      },
      {
        kind: "url",
        value: "https://img.example.test/small-height.jpg",
        width: null,
        height: 48,
      },
      {
        kind: "url",
        value: "https://img.example.test/unknown-height.jpg",
        width: 100,
        height: null,
      },
    ],
    pageUrl,
    allowedOrigins,
  );

  assertEquals(images.map((image) => image.url), [
    "https://img.example.test/unknown-height.jpg",
  ]);
});
