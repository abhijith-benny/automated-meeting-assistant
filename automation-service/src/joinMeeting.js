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

  const args = ['-f', 'pulse', '-i', 'meeting_sink.monitor', outputPath];
  const recorder = spawn('ffmpeg', args, {
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

  // Log chosen audio capture settings
  console.log('🎚️  Selected audio source: alsa_output.pci-0000_00_05.0.analog-stereo.monitor');
  console.log('🎛️  Sample rate: 16000 Hz');
  console.log('🔊 Channels: 1 (mono)');

  recorderProcess = recorder;
  currentRecordingPath = outputPath;
  currentMeetingId = meetingId;
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

async function waitForMeetingEnd(page) {
  console.log('🕒 Waiting for meeting to end...');

  try {
    await page.waitForFunction(() => {
      const text = document.body ? document.body.innerText : '';
      const lowered = text.toLowerCase();

      return (
        lowered.includes('you left the meeting') ||
        lowered.includes('meeting has ended') ||
        lowered.includes('return to home screen') ||
        lowered.includes('you have left the meeting')
      );
    }, { timeout: 0, polling: 2000 });

    console.log('✅ Meeting end detected');
  } catch (err) {
    console.log('⚠️  Meeting end watcher stopped:', err.message);
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
      process.on('SIGINT', () => {
        stopRecording('process interrupted').catch((err) => {
          console.error('⚠️  Failed to stop recording on SIGINT:', err.message);
        });
      });
      process.on('SIGTERM', () => {
        stopRecording('process terminated').catch((err) => {
          console.error('⚠️  Failed to stop recording on SIGTERM:', err.message);
        });
      });

      await waitForMeetingEnd(page);
      await stopRecording('meeting ended');
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
