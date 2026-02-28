const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { triggerTranscription } = require('../sttClient');

let recorderProcess = null;
let currentRecordingPath = null;
let currentMeetingId = null;
let stopRecordingPromise = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function startRecording(meetingId) {
  console.log('🎙️  Starting audio recording with ffmpeg...');
  if (recorderProcess) {
    console.log('ℹ️  Recording already running, skipping new start');
    return;
  }

  const recordingsDir = path.join(__dirname, '..', '..', 'logs', 'recordings');
  ensureDir(recordingsDir);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(recordingsDir, `meeting-${ts}.wav`);

  // Whisper-optimised: mono, 16 kHz, 16-bit PCM, WAV
  const monitorSource = 'alsa_output.pci-0000_00_05.0.analog-stereo.monitor';
  const ffmpegArgs = [
    '-f', 'pulse',
    '-i', monitorSource,
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    outputPath,
  ];

  console.log(`🎚️  Monitor source : ${monitorSource}`);
  console.log(`🎛️  Sample rate    : 16000 Hz`);
  console.log(`🔊 Channels       : 1 (mono)`);
  console.log(`📂 Output file    : ${outputPath}`);
  console.log(`🛠️  ffmpeg args    : ${JSON.stringify(ffmpegArgs)}`);

  const recorder = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  recorder.stdout.on('data', (data) => {
    console.log(`ffmpeg: ${data.toString().trim()}`);
  });

  recorder.stderr.on('data', (data) => {
    console.log(`ffmpeg: ${data.toString().trim()}`);
  });

  recorder.on('error', (err) => {
    console.error('❌ Failed to start ffmpeg:', err.message);
  });

  recorder.on('spawn', () => {
    console.log(`✅ ffmpeg started (pid=${recorder.pid})`);
    console.log(`💾 Recording to: ${outputPath}`);
  });

  recorderProcess = recorder;
  currentRecordingPath = outputPath;
  currentMeetingId = meetingId;
  console.log('🎙 Recording started...');
}

async function stopRecording(reason) {
  if (!recorderProcess && !stopRecordingPromise) return;
  if (stopRecordingPromise) {
    await stopRecordingPromise;
    return;
  }

  const processToStop = recorderProcess;
  const audioFilePath = currentRecordingPath;
  const meetingId = currentMeetingId;

  recorderProcess = null;
  currentRecordingPath = null;
  currentMeetingId = null;

  stopRecordingPromise = (async () => {
    console.log(`🛑 Stopping recording (${reason})...`);

    if (processToStop) {
      await new Promise((resolve) => {
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const timeoutId = setTimeout(finalize, 15000);
        processToStop.once('close', () => {
          clearTimeout(timeoutId);
          finalize();
        });

        try {
          processToStop.kill('SIGINT');
        } catch (err) {
          clearTimeout(timeoutId);
          console.error('❌ Failed to stop ffmpeg:', err.message);
          finalize();
        }
      });
    }

    if (!meetingId || !audioFilePath) {
      console.log('ℹ️  Skipping transcription: missing meetingId or audio path');
      return;
    }

    try {
      console.log(`📝 Starting transcription for meetingId=${meetingId}`);
      const transcriptionResult = await triggerTranscription(meetingId, audioFilePath);
      const transcriptText = transcriptionResult?.transcript || '';

      console.log(`✅ Transcription complete for meetingId=${meetingId}`);
      console.log(`🧾 Transcript (${transcriptText.length} chars): ${transcriptText}`);
    } catch (err) {
      console.error('⚠️  Transcription failed (automation continues):', err.message);
    }
  })();

  try {
    await stopRecordingPromise;
  } finally {
    stopRecordingPromise = null;
  }
}

async function waitForMeetingEnd(page, context) {
  console.log('🕒 Waiting for meeting to end (no time limit)...');

  // Wait 10 seconds after joining before starting status checks
  // so the meeting UI has time to fully stabilise
  console.log('⏳ Letting meeting UI stabilise for 10 seconds...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  let leaveButtonMissCount = 0;

  while (true) {
    console.log('🔍 Checking meeting status...');

    try {
      // 1. Check if the browser page/tab has been closed
      if (page.isClosed()) {
        console.log('🛑 Meeting ended. Leaving meeting... (page closed)');
        break;
      }

      // 2. Check if the URL still points to Google Meet
      const currentUrl = page.url();
      if (!currentUrl.includes('meet.google.com')) {
        console.log('🛑 Meeting ended. Leaving meeting... (navigated away from Meet)');
        break;
      }

      // 3. Check DOM for leave button and participant count
      const status = await page.evaluate(() => {
        const body = document.body ? document.body.innerText : '';
        const lowered = body.toLowerCase();

        // Explicit meeting-ended text takes priority
        if (
          lowered.includes('you left the meeting') ||
          lowered.includes('meeting has ended') ||
          lowered.includes('return to home screen') ||
          lowered.includes('you have left the meeting')
        ) {
          return { state: 'ended', hasLeaveButton: false, participantCount: 0 };
        }

        // Check for the "Leave call" button
        const leaveBtn = document.querySelector(
          '[aria-label="Leave call"], [aria-label="Leave"], [data-tooltip="Leave call"]'
        );
        const hasLeaveButton = !!leaveBtn;

        // Check participant count element
        let participantCount = -1; // -1 means element not found
        // Try multiple selectors for Google Meet participant count
        const participantSelectors = [
          '[data-participant-count]',
          '.gFyGKf',
          '[aria-label*="participant"]',
          '[data-tooltip*="participant"]',
          // The people/participant button often shows count as a badge
          'button[aria-label*="people"] span',
          'button[aria-label*="People"] span',
          // Top-bar participant indicator (the number next to the avatar icon)
          '.uGOf1d',
          '.rua5Nb',
          '.wnPUne',
        ];
        for (const sel of participantSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.textContent || el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || '';
            const match = text.match(/(\d+)/);
            if (match) {
              participantCount = parseInt(match[1], 10);
              break;
            }
          }
        }

        // Fallback: count all visible participant tiles/video elements
        if (participantCount === -1) {
          const tiles = document.querySelectorAll('[data-participant-id], [data-requested-participant-id]');
          if (tiles.length > 0) {
            participantCount = tiles.length;
          }
        }

        return { state: hasLeaveButton ? 'active' : 'no-leave-btn', hasLeaveButton, participantCount };
      }).catch(() => ({ state: 'page-error', hasLeaveButton: false, participantCount: -1 }));

      // Evaluate leave button presence
      if (status.hasLeaveButton) {
        leaveButtonMissCount = 0;
      } else {
        leaveButtonMissCount++;
        console.log(`⚠️ Leave button not found (${leaveButtonMissCount}/3 consecutive misses)`);
      }

      // Log participant info
      if (status.participantCount > 1) {
        console.log(`👥 Participants present (${status.participantCount})`);
      } else if (status.participantCount === 1) {
        console.log('🛑 Meeting ended. Leaving meeting... (only self remaining, participant count is 1)');
        break;
      } else if (status.participantCount === 0) {
        console.log('🛑 Meeting ended. Leaving meeting... (participant count is 0)');
        break;
      }

      // Check if meeting ended via explicit text
      if (status.state === 'ended') {
        console.log('🛑 Meeting ended. Leaving meeting... (meeting ended text detected)');
        break;
      }

      // Check if page became inaccessible
      if (status.state === 'page-error') {
        console.log('🛑 Meeting ended. Leaving meeting... (page inaccessible)');
        break;
      }

      // Check 3 consecutive leave button misses
      if (leaveButtonMissCount >= 3) {
        console.log('🛑 Meeting ended. Leaving meeting... (leave button missing for 3 consecutive checks)');
        break;
      }

      // Still active
      if (status.state === 'active') {
        console.log('✅ Meeting still active');
      }
    } catch (err) {
      // If we cannot interact with the page at all, treat as ended
      console.log('🛑 Meeting ended. Leaving meeting... (page inaccessible)');
      break;
    }

    // Poll every 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log('🛑 Meeting exit confirmed');

  // --- Clean exit sequence ---

  // 1. Click "Leave call" button if visible
  try {
    if (!page.isClosed()) {
      const leaveBtn = page.locator(
        '[aria-label="Leave call"], [aria-label="Leave"], [data-tooltip="Leave call"]'
      ).first();
      if (await leaveBtn.isVisible({ timeout: 2000 })) {
        await leaveBtn.click();
        console.log('📞 Clicked "Leave call" button');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (err) {
    console.log('ℹ️  Could not click leave button:', err.message);
  }

  // 2. Stop ffmpeg recording (SIGINT) and wait for it to fully exit
  await stopRecording('meeting ended');

  // 3. Close browser context (this also closes the browser for persistent contexts)
  try {
    if (context) {
      await context.close();
      console.log('✅ Browser context closed');
      console.log('✅ Browser closed');
    }
  } catch (err) {
    console.log('ℹ️  Browser context already closed:', err.message);
  }
}

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

    page.on('close', () => {
      stopRecording('page closed').catch((err) => {
        console.error('⚠️  Stop recording/transcription failed after page close:', err.message);
      });
    });

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
        const meetingId = `meeting-${Date.now()}`;
        startRecording(meetingId);
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
        const meetingId = `meeting-${Date.now()}`;
        startRecording(meetingId);
      } catch (err) {
        console.log('⚠️  No join button found with text search:', err.message);
        // Final fallback: Enter key
        try {
          await page.keyboard.press('Enter');
          console.log('✅ Pressed Enter key as final fallback');
          joined = true;
          const meetingId = `meeting-${Date.now()}`;
          startRecording(meetingId);
        } catch (enterErr) {
          console.log('⚠️  Enter key failed:', enterErr.message);
        }
      }
    }

    if (!joined) {
      console.log('⚠️  Could not automatically join - you may need to click the join button manually');
    } else {
      const cleanupAndExit = async (signal) => {
        console.log(`\n🛑 Received ${signal}, cleaning up...`);
        await stopRecording(`process ${signal.toLowerCase()}`).catch((err) => {
          console.error(`⚠️  Failed to stop recording on ${signal}:`, err.message);
        });
        try { await context.close(); } catch (_) { /* already closed */ }
        process.exit(0);
      };

      process.on('SIGINT', () => cleanupAndExit('SIGINT'));
      process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));

      await waitForMeetingEnd(page, context);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Meeting join process completed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏰ Completed at:', new Date().toISOString());
    console.log('');

  } catch (err) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FATAL ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Safety net: ensure recording stops and browser closes on any fatal error
    await stopRecording('fatal error').catch(() => {});
    process.exit(1);
  }
})();
