# 📧 Email Notification Testing Guide

## Step 1: Configure SMTP Settings

### Option A: Using Gmail (Recommended for testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password

3. **Add to `backend/.env` file**:
```env
# Email Notifications
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password-here"
SMTP_FROM="Polymarket Alerts <your-email@gmail.com>"
```

### Option B: Using Other Email Services

**Outlook/Hotmail:**
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@outlook.com"
SMTP_PASS="your-password"
SMTP_FROM="Polymarket Alerts <your-email@outlook.com>"
```

**Yahoo:**
```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@yahoo.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Polymarket Alerts <your-email@yahoo.com>"
```

## Step 2: Restart Backend Server

After adding SMTP settings, restart the backend:

```powershell
# Stop current backend (Ctrl+C in terminal)
# Then restart:
cd backend
npm start
```

## Step 3: Test Email Notifications

### Method 1: Using Frontend UI (Easiest)

1. Open http://localhost:5173 in your browser
2. **Login** to your account
3. Navigate to **Settings** page (from sidebar)
4. Under **Email Notifications**:
   - Make sure the toggle is **ON** (enabled)
5. Scroll down to **Default Notification Channels**
6. Click the **"Send Test Notification"** button
7. Check your email inbox (including spam folder)

### Method 2: Using API Directly

Use PowerShell to test:

```powershell
# First, login to get your token
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"username":"your-username","password":"your-password"}'

$token = $loginResponse.token

# Send test notification
Invoke-RestMethod -Uri "http://localhost:3000/notifications/test" `
    -Method POST `
    -Headers @{Authorization="Bearer $token"} `
    -ContentType "application/json"
```

### Method 3: Using cURL

```bash
# Login
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}

# Copy the token from response, then:
POST http://localhost:3000/notifications/test
Authorization: Bearer YOUR_TOKEN_HERE
```

## Step 4: Verify Email Settings

### Check notification settings:

```powershell
# Get your settings
Invoke-RestMethod -Uri "http://localhost:3000/notifications/settings" `
    -Method GET `
    -Headers @{Authorization="Bearer $token"}
```

Expected response:
```json
{
  "success": true,
  "settings": {
    "emailEnabled": true,
    "discordEnabled": false,
    "defaultChannels": ["email"]
  }
}
```

## Step 5: Test with Real Alert

1. Create a real price alert in the app
2. The alert monitoring service will check prices every 60 seconds
3. When triggered, you'll receive an email automatically

## Troubleshooting

### ✅ Email not received?

**Check 1: SMTP Configuration**
```powershell
# Verify SMTP settings are loaded
cd backend
$env:SMTP_HOST
$env:SMTP_USER
```

**Check 2: Backend Logs**
Look for these messages in backend terminal:
- ✅ `Email notification sent to your-email@gmail.com`
- ❌ `Email transporter not configured`
- ❌ `Error sending email notification`

**Check 3: Email Enabled**
Make sure email notifications are enabled in settings page

**Check 4: Spam Folder**
Check your spam/junk folder

**Check 5: App Password**
For Gmail, make sure you're using an App Password, not your regular password

### ✅ Still not working?

1. **Restart the backend** after adding SMTP settings
2. Check that your email/password are correct
3. Try using a different email service
4. Check firewall isn't blocking port 587

## Expected Email Content

You should receive an email like this:

**Subject:** 🔔 Alert Triggered: Will Bitcoin reach $100,000 by end of 2026?

**Body:**
```
🔔 Alert Triggered

Will Bitcoin reach $100,000 by end of 2026?
Outcome: Yes

Price Alert
Price above target

currentPrice: 0.7500
targetPrice: 0.7000
condition: Above

View Market & Trade: [Link Button]

This is an automated alert from your Polymarket Alert System.
```

## Production Deployment

For production (Vercel), add SMTP settings as environment variables:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all SMTP_* variables
3. Redeploy the backend

---

✅ Once you receive the test email, your notification system is working correctly!
