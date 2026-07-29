"use strict";

const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const screens = Array.from({ length: 27 }, (_, index) => `WF-${String(index + 1).padStart(2, "0")}`);

async function auditViewport(browser, viewport, mobile) {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  for (const id of screens) {
    await page.goto(`${url}#${id}`, { waitUntil: "load" });
    await page.waitForFunction((screenId) => document.getElementById("screenCode")?.textContent === screenId, id);

    const findings = await page.evaluate(({ mobileMode, expectedId }) => {
      const issues = [];
      const duplicateIds = [...document.querySelectorAll("[id]")]
        .map((node) => node.id)
        .filter((value, index, values) => values.indexOf(value) !== index);
      if (duplicateIds.length) issues.push(`duplicate ids: ${[...new Set(duplicateIds)].join(", ")}`);

      const unnamed = [...document.querySelectorAll("button, a, input, select, textarea")].filter((node) => {
        if (node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") || node.title) return false;
        if (node.matches("input, select, textarea") && node.closest("label")) return false;
        return !String(node.innerText || node.value || node.alt || "").trim();
      });
      if (unnamed.length) issues.push(`${unnamed.length} interactive elements lack an accessible name`);

      if (document.getElementById("screenCode")?.textContent !== expectedId) issues.push("route did not render expected screen");
      if (document.documentElement.scrollWidth > window.innerWidth + 2) issues.push(`page horizontal overflow ${document.documentElement.scrollWidth}px > ${window.innerWidth}px`);

      if (mobileMode) {
        const undersized = [...document.querySelectorAll("button, a, select")]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return style.display !== "none" && rect.width > 0 && rect.height > 0 && (rect.height < 44 || rect.width < 44);
          });
        if (undersized.length) {
          const sample = undersized.slice(0, 5).map((node) => {
            const rect = node.getBoundingClientRect();
            return `${node.tagName.toLowerCase()}[${String(node.textContent || node.getAttribute("aria-label") || "").trim().slice(0, 24)}]=${Math.round(rect.width)}x${Math.round(rect.height)}`;
          }).join(", ");
          issues.push(`${undersized.length} touch targets smaller than 44px (${sample})`);
        }
      }
      return issues;
    }, { mobileMode: mobile, expectedId: id });

    findings.forEach((finding) => errors.push(`${id}: ${finding}`));
  }

  await page.close();
  return errors;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktopErrors = await auditViewport(browser, { width: 1440, height: 1000 }, false);
  const mobileErrors = await auditViewport(browser, { width: 390, height: 844 }, true);
  await browser.close();

  const errors = [...desktopErrors, ...mobileErrors];
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Verified 27 screens at 1440px and 390px: routes, console, accessible names, overflow and mobile target sizes passed.");
  }
})();
