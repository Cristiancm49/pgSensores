import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/ccortesm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const baseUrl = "http://localhost:15173";
const outputDir = path.resolve("documentation/screenshots");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});
const page = await context.newPage();

async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
}

async function capture(name) {
  await settle();
  await page.screenshot({
    path: path.join(outputDir, name),
    fullPage: false,
    animations: "disabled",
  });
  console.log(`captured ${name} — ${page.url()}`);
}

async function go(relativeUrl, name) {
  await page.goto(`${baseUrl}${relativeUrl}`, { waitUntil: "domcontentloaded" });
  await capture(name);
}

async function clickTab(label, name) {
  const exact = page.getByRole("button", { name: label, exact: true });
  const fuzzy = page.getByRole("button", { name: new RegExp(label, "i") });
  const target = (await exact.count()) ? exact.first() : fuzzy.first();
  if (await target.count()) {
    await target.click();
    await capture(name);
  } else {
    console.warn(`tab not found: ${label}`);
  }
}

await go("/login", "01_login.png");
await page.getByPlaceholder("Tu nombre de usuario").fill("admin");
await page.locator('input[type="password"]').fill("Admin123!");
await page.getByRole("button", { name: /Ingresar/i }).click();
await page.waitForURL(/\/app\//, { timeout: 15000 });
await capture("02_dashboard.png");

await go("/app/proyectos", "03_projects.png");
const projectHref = await page.locator('a[href^="/app/proyectos/"]').first().getAttribute("href");
if (projectHref) {
  await go(projectHref, "04_project_detail.png");
  await clickTab("Ubicaciones", "05_project_locations.png");
  await clickTab("Integrantes", "06_project_members.png");
  await clickTab("Documentación", "07_project_documentation.png");
  await clickTab("Archivos", "08_project_files.png");
}

await go("/app/dispositivos", "09_devices.png");
const deviceHref = await page.locator('a[href^="/app/dispositivos/"]').first().getAttribute("href");
if (deviceHref) {
  await go(deviceHref, "10_device_sensors.png");
  await clickTab("Actuadores", "11_device_actuators.png");
  await clickTab("Credenciales MQTT", "12_device_credentials.png");
}

await go("/app/sensores", "13_sensors.png");
await go("/app/actuadores", "14_actuators.png");
await go("/app/alertas", "15_alerts.png");
await go("/app/ubicaciones", "16_locations.png");
await go("/app/usuarios", "17_users.png");
await go("/app/perfil", "18_profile.png");

await browser.close();
