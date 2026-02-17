# 🤖 Automated Meeting Assistant

Automatically join Google Meet meetings with a single click! No scheduling, no account selection, no time checks - just paste a link and go.

## ✨ Features

- 🚀 **Instant Join**: Paste any Google Meet link and join immediately
- 🎥 **Auto Controls**: Automatically turns off camera and microphone
- 🤖 **Browser Automation**: Uses Playwright to control Brave browser
- 📝 **Detailed Logging**: Full logs of every join attempt
- 🔒 **Uses Your Profile**: Leverages your existing logged-in Google account

## 🎯 Quick Start

### 1️⃣ Find Your Brave Browser Paths
```powershell
.\find-brave-path.ps1
```
Copy the output and save it - you'll need it in step 3.

### 2️⃣ Install Dependencies
```powershell
# Install automation service dependencies
cd automation-service
npm install

# Install frontend dependencies
cd ..\frontend
npm install

# Go back to root
cd ..
```

### 3️⃣ Configure Browser Paths

Edit [frontend/src/pages/SchedulerForm.jsx](frontend/src/pages/SchedulerForm.jsx) (lines 27-28) and replace with your paths from step 1:

```javascript
const braveExecutable = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
const userDataDir = 'C:\\Users\\YourName\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Default'
```

### 4️⃣ Start the Application

**Option A: Use the launcher script (recommended)**
```powershell
.\start.ps1
```

**Option B: Start manually**

Terminal 1 (Automation Service):
```powershell
cd automation-service
npm start
```

Terminal 2 (Frontend):
```powershell
cd frontend
npm run dev
```

### 5️⃣ Join a Meeting!

1. Open http://localhost:5173 in your browser
2. Paste a Google Meet link (e.g., `https://meet.google.com/xxx-xxxx-xxx`)
3. Click "Join Meeting Now"
4. Watch as the browser automatically joins the meeting! 🎉

## 📋 Testing

### Quick Health Check
```powershell
.\test.ps1
```

### Full Test Suite
See [TESTING.md](TESTING.md) for comprehensive testing commands.

### Manual Tests

**Check automation service:**
```powershell
curl http://localhost:4001/health
```

**Check frontend:**
```powershell
curl http://localhost:5173
```

**Test join API directly:**
```powershell
$body = @{
    url = "https://meet.google.com/xxx-xxxx-xxx"
    braveExecutable = "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
    userDataDir = "C:\Users\YourName\AppData\Local\BraveSoftware\Brave-Browser\User Data\Default"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:4001/api/meetings" -Method POST -ContentType "application/json" -Body $body
```

## 📁 Project Structure

```
automated-meeting-assistant/
├── automation-service/     # Express server + Playwright automation
│   ├── src/
│   │   ├── server.js      # REST API server
│   │   └── joinMeeting.js # Browser automation script
│   └── logs/              # Join attempt logs
│
├── frontend/              # React frontend
│   └── src/
│       ├── pages/
│       │   └── SchedulerForm.jsx  # Main join page
│       └── api/
│           └── meeting.js         # API client
│
├── find-brave-path.ps1   # Helper to find browser paths
├── start.ps1             # Quick start launcher
├── test.ps1              # Test suite
├── TESTING.md            # Detailed testing guide
└── SETUP.md              # Detailed setup guide
```

## 🔧 How It Works

1. **Frontend** (React + Vite): Simple UI where you paste meeting links
2. **Automation Service** (Express): REST API that receives join requests
3. **Browser Automation** (Playwright): Controls Brave to join meetings

**Flow:**
```
User pastes link → Frontend calls API → Server spawns Playwright → Browser joins meeting
```

## 🐛 Troubleshooting

### Browser doesn't open
- ✅ Verify Brave paths are correct: Run `.\find-brave-path.ps1`
- ✅ Check if Brave is installed: `Test-Path "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"`
- ✅ Make sure profile path exists

### "Missing url/userDataDir/braveExecutable" error
- ✅ Check that you updated `SchedulerForm.jsx` with correct paths
- ✅ Make sure paths use double backslashes: `C:\\Users\\...`
- ✅ Verify paths exist on your system

### Services won't start
- ✅ Check if ports are available: `Get-NetTCPConnection -LocalPort 4001,5173`
- ✅ Make sure dependencies are installed: `npm install`
- ✅ Check for error messages in terminal

### Browser opens but doesn't join
- ✅ Make sure you're logged into Google in Brave
- ✅ Check the logs: `Get-Content automation-service\logs\join-*.log | Select-Object -Last 50`
- ✅ Try joining a meeting manually in Brave to test your login

### Check logs for details
```powershell
# View most recent log
Get-Content (Get-ChildItem automation-service\logs | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

## 🎯 Commands Reference

| Command | Description |
|---------|-------------|
| `.\find-brave-path.ps1` | Find Brave browser paths on your system |
| `.\start.ps1` | Start both services |
| `.\test.ps1` | Run health checks |
| `.\start.ps1 -AutomationOnly` | Start only automation service |
| `.\start.ps1 -FrontendOnly` | Start only frontend |
| `.\start.ps1 -Check` | Check if services are running |

## 📚 Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [SYSTEM.md](SYSTEM.md) - System architecture

## ⚙️ Configuration

### Ports
- **Automation Service**: 4001
- **Frontend**: 5173

### Environment Variables

You can customize the automation service port:
```powershell
$env:PORT = "4001"
cd automation-service
npm start
```

For frontend, edit `vite.config.js` to change the port.

## 🔐 Security Notes

- The automation uses your existing logged-in Google account in Brave
- No credentials are stored or transmitted
- All communication is over localhost
- Browser profile data stays on your machine

## 🚀 Production Deployment

This is designed for local development. For production:
1. Add authentication to the API
2. Use environment variables for all paths
3. Add rate limiting
4. Use HTTPS
5. Add proper error handling and monitoring

## 📝 License

This project is for educational and personal use.

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/)
- Frontend powered by [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Backend using [Express](https://expressjs.com/)

## 📞 Support

Having issues? Check these resources:
1. Run `.\test.ps1` to diagnose problems
2. Check [TESTING.md](TESTING.md) for detailed troubleshooting
3. Review logs in `automation-service/logs/`
4. Verify your configuration with `.\find-brave-path.ps1`

---

Made with ❤️ by Abhijith Benny