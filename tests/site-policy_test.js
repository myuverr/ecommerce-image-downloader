import { deepStrictEqual as eq } from "node:assert/strict";
import {
  ALLOWED_IMAGE_ORIGINS,
  isSupportedProductPage,
  matchesProductPageUrl,
  SUPPORTED_PAGE_MATCHES,
  SUPPORTED_PAGE_ORIGINS,
} from "../extension/src/site-policy.js";

Deno.test("sitePolicyMatchesExactOriginAndPathPrefix", () => {
  const policy = { origin: "https://page.example.test", pathPrefix: "/item/" };
  eq(
    matchesProductPageUrl(
      "https://page.example.test/item/100?from=fixture",
      policy,
    ),
    true,
  );
  for (
    const url of [
      "http://page.example.test/item/100",
      "https://other.example.test/item/100",
      "https://page.example.test/items/100",
      "https://user:pass@page.example.test/item/100",
      "https://page.example.test.evil/item/100",
      null,
    ]
  ) eq(matchesProductPageUrl(url, policy), false);
});
Deno.test("productionPolicyAllowsOnlyExperimentalSuningNumericDetail", () => {
  eq(SUPPORTED_PAGE_MATCHES, ["https://product.suning.com/*"]);
  eq(SUPPORTED_PAGE_ORIGINS, ["https://product.suning.com"]);
  eq(ALLOWED_IMAGE_ORIGINS, ["https://imgservice.suning.cn"]);
  eq(
    isSupportedProductPage(
      "https://product.suning.com/0070143049/12449515092.html?from=test",
    ),
    true,
  );
  for (
    const url of [
      "http://product.suning.com/0070143049/12449515092.html",
      "https://product.suning.com/",
      "https://product.suning.com/login",
      "https://product.suning.com/search/123.html",
      "https://product.suning.com/123/a.html",
      "https://product.suning.com/123/456.html/extra",
      "https://passport.suning.com/123/456.html",
      "https://product.suning.com.evil/123/456.html",
      "https://u:p@product.suning.com/123/456.html",
      "https://item.jd.com/100.html",
      "http://localhost/123/456.html",
    ]
  ) eq(isSupportedProductPage(url), false);
});
