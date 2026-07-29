"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const desktopDir = path.join(root, "screenshots", "desktop");
const mobileDir = path.join(root, "screenshots", "mobile");

fs.mkdirSync(desktopDir, { recursive: true });
fs.mkdirSync(mobileDir, { recursive: true });

const allScreens = Array.from({ length: 27 }, (_, index) => `WF-${String(index + 1).padStart(2, "0")}`);
const mobileScreens = ["WF-17", "WF-18", "WF-19", "WF-20", "WF-21", "WF-23", "WF-24", "WF-25", "WF-26", "WF-27"];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  desktop.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  desktop.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  for (const id of allScreens) {
    await desktop.goto(`${url}#${id}`, { waitUntil: "load" });
    await desktop.waitForFunction((screenId) => document.getElementById("screenCode")?.textContent === screenId, id);
    await desktop.screenshot({ path: path.join(desktopDir, `${id}.png`), fullPage: true });
  }

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  mobile.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  for (const id of mobileScreens) {
    await mobile.goto(`${url}#${id}`, { waitUntil: "load" });
    await mobile.waitForFunction((screenId) => document.getElementById("screenCode")?.textContent === screenId, id);
    await mobile.screenshot({ path: path.join(mobileDir, `${id}-mobile.png`), fullPage: true });
  }

  await browser.close();

  if (consoleErrors.length) {
    console.error(consoleErrors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Captured ${allScreens.length} desktop and ${mobileScreens.length} mobile screenshots with no console errors.`);
  }
})();
