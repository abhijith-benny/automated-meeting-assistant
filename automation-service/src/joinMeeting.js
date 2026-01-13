#!/usr/bin/env node
console.log(process.argv);

const fs = require('fs');
const { chromium } = require('playwright');

/* ================= ARG PARSING ================= */

function parseArgs() {
  const args = {};
  const positional = [];

  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v === undefined ? true : v;
    } else {
      positional.push(a);
    }
  }

  if (!args.url && positional[0]) args.url = positional[0];
  if (!args.braveExecutable && positional[1]) args.braveExecutable = positional[1];
  if (!args.userDataDir && positional[2]) args.userDataDir = positional[2];

  return args;
}

/* ================= SAFETY ================= */

function assertFileExists(label, p) {
  if (!p || !fs.existsSync(p)) {
    console.error(`❌ ${label} not found:`, p);
    process.exit(1);
  }
}

/* ================= MAIN ================= */

async function joinMeeting({ url, userDataDir, braveExecutable }) {
  if (!url) {
    console.error('❌ Missing meeting URL');
    process.exit(1);
  }

  assertFileExists('Brave executable', braveExecutable);

  if (!userDataDir) {
    console.error('❌ userDataDir is required');
    process.exit(1);
  }

  console.log('✅ Brave:', braveExecutable);
  console.log('✅ Profile:', userDataDir);

  /* ---------- Launch Brave ---------- */
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: braveExecutable,
    viewport: { width: 1280, height: 720 },
    args: [
      '--use-fake-ui-for-media-stream',
      '--no-default-browser-check',
      '--no-first-run'
    ]
  });

  const page = await context.newPage();

  /* ---------- Verify browser ---------- */
  const ua = await page.evaluate(() => navigator.userAgent);
  console.log('🧪 UA:', ua);

  if (ua.includes('Edg/')) {
    console.error('❌ Edge detected — aborting');
    process.exit(1);
  }

  /* ---------- Navigate ---------- */
  console.log('🌐 Opening meeting...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  /* ---------- Permissions ---------- */
  try {
    const origin = new URL(url).origin;
    await context.grantPermissions(['microphone', 'camera'], { origin });
  } catch {}

  /* ================= GOOGLE MEET FLOW ================= */

  if (url.includes('meet.google.com')) {
    // Let Meet render pre-join UI
    await page.waitForTimeout(3000);

    // Turn off camera
    await page
      .getByRole('button', { name: /turn off camera/i })
      .click()
      .catch(() => {});

    // Turn off microphone
    await page
      .getByRole('button', { name: /turn off microphone/i })
      .click()
      .catch(() => {});

    // Join / Ask to join
    await page
      .getByRole('button', { name: /ask to join|join now/i })
      .click()
      .catch(() => {
        console.log('⚠️ Join button not found');
      });
  }

  console.log('🟢 Browser remains open.');
}

/* ================= ENTRY ================= */

(async () => {
  const args = parseArgs();

  await joinMeeting({
    url: args.url,
    userDataDir: args.userDataDir,
    braveExecutable: args.braveExecutable
  });
})().catch(err => {
  console.error(err);
  process.exit(1);
});
