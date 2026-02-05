const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  try {
    // Arguments from server.js
    const meetUrl = process.argv[2];
    const braveExecutable = process.argv[3];
    const userDataDir = process.argv[4];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting Meeting Join Process');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏰ Time:', new Date().toISOString());

    if (!meetUrl || !braveExecutable || !userDataDir) {
      console.error('❌ Missing required arguments:');
      console.error('   meetUrl:', meetUrl ? '✓' : '✗');
      console.error('   braveExecutable:', braveExecutable ? '✓' : '✗');
      console.error('   userDataDir:', userDataDir ? '✓' : '✗');
      process.exit(1);
    }

    // Verify paths exist
    if (!fs.existsSync(braveExecutable)) {
      console.error('❌ Brave executable not found at:', braveExecutable);
      process.exit(1);
    }

    if (!fs.existsSync(userDataDir)) {
      console.error('❌ User data directory not found at:', userDataDir);
      process.exit(1);
    }

    console.log('✅ Configuration validated');
    console.log('🔗 Meeting URL:', meetUrl);
    console.log('📁 Profile:', userDataDir);
    console.log('🌐 Browser:', braveExecutable);
    console.log('');

    console.log('🚀 Launching browser...');
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: braveExecutable,
      permissions: ['camera', 'microphone'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream'
      ]
    });
    console.log('✅ Browser launched successfully');

    const page = await context.newPage();
    console.log('📄 New page created');

    console.log('🌐 Navigating to meeting:', meetUrl);
    await page.goto(meetUrl, { waitUntil: 'domcontentloaded' });
    console.log('✅ Page loaded');

    // Wait for Google Meet interface to load - more robust than fixed timeout
    console.log('⏳ Waiting for Google Meet interface to load...');
    try {
      // Wait for either the join button or the meeting controls to appear
      await page.waitForFunction(() => {
        return document.querySelector('[role="button"][aria-label*="join"], [role="button"][aria-label*="Join"], [data-testid*="join"]') ||
               document.querySelector('[role="button"][aria-label*="camera"], [role="button"][aria-label*="microphone"]');
      }, { timeout: 15000 });
      console.log('✅ Google Meet interface detected');
    } catch (err) {
      console.log('⚠️  Could not detect Meet interface within 15s, proceeding anyway');
    }

    // Additional small wait for stability
    await page.waitForTimeout(2000);

    console.log('🎤📹 Disabling camera and microphone...');
    
    // Use keyboard shortcuts first for reliability (they don't depend on UI loading)
    try {
      await page.keyboard.press('Control+KeyE'); // Turn off camera
      console.log('✅ Camera turned off via Ctrl+E');
      await page.waitForTimeout(500);
    } catch (err) {
      console.log('⚠️  Camera keyboard shortcut failed:', err.message);
    }

    try {
      await page.keyboard.press('Control+KeyD'); // Turn off microphone
      console.log('✅ Microphone turned off via Ctrl+D');
      await page.waitForTimeout(500);
    } catch (err) {
      console.log('⚠️  Microphone keyboard shortcut failed:', err.message);
    }

    // As backup, try clicking buttons if they exist
    try {
      const cameraButton = page.getByRole('button', { name: 'Turn off camera' });
      if (await cameraButton.isVisible({ timeout: 1000 })) {
        await cameraButton.click();
        console.log('✅ Camera button clicked as backup');
      }
    } catch (err) {
      console.log('ℹ️  Camera button not found or not needed');
    }

    try {
      const micButton = page.getByRole('button', { name: 'Turn off microphone' });
      if (await micButton.isVisible({ timeout: 1000 })) {
        await micButton.click();
        console.log('✅ Microphone button clicked as backup');
      }
    } catch (err) {
      console.log('ℹ️  Microphone button not found or not needed');
    }

    // Ask to join - try multiple button variations
    console.log('🚪 Attempting to join meeting...');
    let joined = false;

    // Try different button selectors in order of preference
    const joinSelectors = [
      { role: 'button', name: 'Ask to join' },
      { role: 'button', name: 'Join now' },
      { role: 'button', name: 'Join' },
    ];

    for (const selector of joinSelectors) {
      if (joined) break;

      try {
        const button = page.getByRole(selector.role, { name: selector.name });
        await button.click({ timeout: 3000 });
        console.log(`✅ Joined using "${selector.name}" button`);
        joined = true;
        await page.waitForTimeout(1000); // Wait for join action to process
      } catch (err) {
        console.log(`⚠️  "${selector.name}" button not found or failed:`, err.message);
      }
    }

    // As a last resort, try pressing Enter key or look for any button with "join" text
    if (!joined) {
      try {
        // Try to find any button containing "join" (case insensitive)
        const anyJoinButton = page.locator('button').filter({ hasText: /join/i });
        await anyJoinButton.first().click({ timeout: 3000 });
        console.log('✅ Found and clicked a button containing "join"');
        joined = true;
      } catch (err) {
        console.log('⚠️  No join button found with text search:', err.message);
        // Final fallback: Enter key
        try {
          await page.keyboard.press('Enter');
          console.log('✅ Pressed Enter key as final fallback');
          joined = true;
        } catch (enterErr) {
          console.log('⚠️  Enter key failed:', enterErr.message);
        }
      }
    }

    if (!joined) {
      console.log('⚠️  Could not automatically join - you may need to click the join button manually');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Meeting join process completed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏰ Completed at:', new Date().toISOString());
    console.log('');
    console.log('💡 The browser window will remain open.');
    console.log('💡 You may need to wait for the host to admit you.');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FATAL ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }
})();
