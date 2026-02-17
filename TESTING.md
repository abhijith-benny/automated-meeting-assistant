# Automated Meeting Assistant - Testing Guide

This guide shows you how to test that everything is working properly.

## Prerequisites Check

Run this PowerShell script to find your Brave browser paths:
```powershell
.\find-brave-path.ps1
```

Copy the output and update `frontend\src\pages\SchedulerForm.jsx` (lines 27-28).

## Starting the Services

### Terminal 1: Start Automation Service
```powershell
cd automation-service
npm install  # First time only
npm start
```

**Expected output:**
```
═══════════════════════════════════════════════════════
🚀 Automation Service Started
═══════════════════════════════════════════════════════
📡 Listening on: http://localhost:4001
📁 Logs directory: c:\programs\automated-meeting-assistant\automation-service\logs
🕐 Started at: 2026-01-14T...
═══════════════════════════════════════════════════════

Waiting for requests...
```

### Terminal 2: Start Frontend
```powershell
cd frontend
npm install  # First time only
npm run dev
```

**Expected output:**
```
  VITE v5.0.0  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Running Tests

### Test 1: Run Automated Test Suite
```powershell
.\test.ps1
```

This will check:
- ✅ Automation service is running
- ✅ Frontend is running
- ✅ All required files exist
- ✅ Dependencies are installed

**Expected output:** All green checkmarks

### Test 2: Check Automation Service Health
```powershell
curl http://localhost:4001/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-01-14T10:30:00.000Z"}
```

### Test 3: Check Automation Service Info
```powershell
curl http://localhost:4001
```

**Expected response:**
```json
{
  "status":"running",
  "service":"automation-service",
  "timestamp":"2026-01-14T10:30:00.000Z"
}
```

### Test 4: Test API Endpoint Directly

**Important:** Update the paths below to match your system (use output from `find-brave-path.ps1`)

```powershell
$body = @{
    url = "https://meet.google.com/test-xxxx-xxx"
    braveExecutable = "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
    userDataDir = "C:\Users\YourName\AppData\Local\BraveSoftware\Brave-Browser\User Data\Default"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:4001/api/meetings" -Method POST -ContentType "application/json" -Body $body
```

**Expected response:**
```json
{
  "started": true,
  "pid": 12345,
  "log": "logs\\join-1737123456789-12345.log"
}
```

**Expected behavior:** A Brave browser window should open

### Test 5: Check Frontend is Accessible
```powershell
curl http://localhost:5173
```

Should return HTML content (status 200).

### Test 6: Full End-to-End Test

1. Open browser and navigate to: `http://localhost:5173`
2. You should see "Quick Join Meeting" page
3. Paste a Google Meet link: `https://meet.google.com/xxx-xxxx-xxx`
4. Click "Join Meeting Now"
5. Expected behavior:
   - Status changes to "Joining meeting..."
   - After 1-2 seconds, you see "✅ Successfully joined!"
   - A new Brave browser window opens
   - The browser navigates to the Google Meet link
   - Camera and microphone are automatically turned off
   - "Ask to join" button is clicked automatically

### Test 7: Check Logs

After joining a meeting, check the logs:

```powershell
# List all log files
Get-ChildItem automation-service\logs

# View the most recent log file
Get-Content (Get-ChildItem automation-service\logs | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

**Expected log content:**
```
=== spawn 2026-01-14T... pid=12345 args=...
🔗 Joining meeting: https://meet.google.com/xxx-xxxx-xxx
📁 Profile: C:\Users\...
🌐 Browser: C:\Program Files\BraveSoftware\...
✅ Join flow executed
=== exit code=0 signal=null at ...
```

## Troubleshooting Tests

### Issue: Automation service won't start

**Test:**
```powershell
cd automation-service
node src\server.js
```

**Common causes:**
- Port 4001 already in use: `Get-NetTCPConnection -LocalPort 4001`
- Missing dependencies: Run `npm install`

### Issue: Frontend won't start

**Test:**
```powershell
cd frontend
npm run dev
```

**Common causes:**
- Port 5173 already in use
- Missing dependencies: Run `npm install`

### Issue: Browser doesn't open

**Test if Brave is accessible:**
```powershell
# Test 1: Check if Brave exists
Test-Path "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"

# Test 2: Try to open Brave manually
& "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
```

**Common causes:**
- Wrong path in SchedulerForm.jsx
- Brave not installed
- Profile path incorrect

### Issue: "Missing url/userDataDir/braveExecutable"

**Test the API with verbose output:**
```powershell
$body = @{
    url = "https://meet.google.com/test"
    braveExecutable = "YOUR_PATH_HERE"
    userDataDir = "YOUR_PROFILE_HERE"
} | ConvertTo-Json

Write-Host "Sending request with body:"
Write-Host $body

try {
    $response = Invoke-WebRequest -Uri "http://localhost:4001/api/meetings" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Response:"
    $response.Content
} catch {
    Write-Host "Error:"
    $_.Exception.Message
    Write-Host "Response:"
    $_.Exception.Response
}
```

### Issue: Browser opens but doesn't join

**Check if Google is logged in:**
1. Open Brave manually with your profile
2. Go to google.com
3. Verify you're logged in
4. Try joining a meeting manually

**Check automation logs:**
```powershell
Get-Content automation-service\logs\join-*.log | Select-Object -Last 50
```

## Quick Verification Commands

Copy and paste these to quickly check everything:

```powershell
# One-liner to check all services
Write-Host "Automation Service:" -ForegroundColor Yellow; (Invoke-WebRequest http://localhost:4001/health -UseBasicParsing).Content; Write-Host "`nFrontend:" -ForegroundColor Yellow; (Invoke-WebRequest http://localhost:5173 -UseBasicParsing).StatusCode
```

```powershell
# One-liner to check if processes are running
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Select-Object ProcessName, Id, StartTime
```

```powershell
# One-liner to see recent logs
Get-ChildItem automation-service\logs -Filter "join-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

## Success Criteria

✅ **Everything is working when:**

1. ✅ Test script (`.\test.ps1`) shows all green checkmarks
2. ✅ Both services start without errors
3. ✅ Frontend loads at http://localhost:5173
4. ✅ Pasting a link and clicking "Join Meeting Now" opens Brave
5. ✅ Browser automatically navigates to the meeting
6. ✅ Camera and mic are turned off automatically
7. ✅ "Ask to join" is clicked automatically
8. ✅ Logs show successful execution
9. ✅ No errors in browser console (F12)
10. ✅ No errors in automation service terminal

## Performance Tests

### Test Response Time
```powershell
Measure-Command {
    Invoke-WebRequest -Uri "http://localhost:4001/health" -UseBasicParsing
}
```
Should be < 100ms

### Test Meeting Join Time
```powershell
$start = Get-Date
# Click "Join Meeting Now" in browser
# Wait for browser to open and navigate
$end = Get-Date
$duration = $end - $start
Write-Host "Join time: $($duration.TotalSeconds) seconds"
```
Should be < 5 seconds

## Next Steps After Successful Testing

Once all tests pass:
1. ✅ Update the browser paths to match your system
2. ✅ Test with a real Google Meet link
3. ✅ Verify the meeting joins successfully
4. ✅ Check that camera/mic are off
5. ✅ Confirm "Ask to join" works

Ready to use! 🎉
