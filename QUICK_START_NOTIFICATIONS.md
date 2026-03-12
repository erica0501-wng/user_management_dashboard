# Quick Start - Notification System

## 🚀 Setup Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

The updated `package.json` already includes `nodemailer` for email notifications.

### 2. Run Database Migration

Apply the schema changes to add notification settings:

```bash
cd backend
npx prisma migrate dev --name add_notification_settings
npx prisma generate
```

This will:
- Add `NotificationSettings` table
- Add `notificationChannels` field to alerts
- Update the User model with notification settings relation

### 3. Configure Environment Variables (Optional)

Copy the example file:
```bash
cd backend
cp .env.example .env
```

Add your notification credentials to `.env`:

**For Email (Gmail):**
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Alerts <your-email@gmail.com>"
```

**For Telegram:**
```env
TELEGRAM_BOT_TOKEN="your-bot-token-from-botfather"
```

See [NOTIFICATION_SETUP.md](./NOTIFICATION_SETUP.md) for detailed setup instructions.

### 4. Start the Servers

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Configure Notifications

1. Log in to your app
2. Navigate to **Settings** (new menu item in sidebar)
3. Enable and configure your notification channels:
   - **Email**: Enabled by default (uses registered email)
   - **Telegram**: Enter your Chat ID after setting up the bot
   - **Discord**: Paste your webhook URL

4. Click "Save Settings"
5. Use "Send Test Alert" to verify everything works

### 6. Create Alerts with Notifications

1. Go to **Polymarket** page
2. Click on any market to view details
3. Click "Create Alert" in the Alerts panel
4. Configure your alert (Price or Order Book)
5. **Select notification channels** (new feature!)
6. Create the alert

When the alert triggers, you'll receive notifications on all selected channels!

## ✨ New Features

### Settings Page (`/settings`)
- Configure email, Telegram, and Discord notifications
- Set default notification channels for new alerts
- Test notifications
- Connect/disconnect integrations

### Enhanced Alert Manager
- Select specific notification channels per alert
- See which channels are configured
- Link to settings page for configuration

### Notification Service
- Sends rich notifications with market details
- Includes direct link to trade on Polymarket
- Beautiful formatting for each channel:
  - Email: HTML formatted with action button
  - Telegram: Markdown with inline link
  - Discord: Rich embed with trade button

## 📝 Notes

- Notifications are **optional** - the system works without any configuration
- Email is enabled by default but requires SMTP configuration to send
- Telegram and Discord require setup but provide instant notifications
- Each alert can use different notification channels
- Successfully triggered alerts are marked in the UI

## 🔍 What Changed?

**Database:**
- Added `NotificationSettings` model
- Added `notificationChannels` field to `Alert` model

**Backend:**
- New route: `/notifications/*` for managing settings
- New service: `notificationService.js` for sending notifications
- Updated `alertMonitoring.js` to trigger notifications
- Updated `alert.js` routes to support notification channels

**Frontend:**
- New page: `SettingsPage.jsx` for configuration
- Updated `AlertManager.jsx` with channel selection
- Updated `Sidebar.jsx` with Settings link
- Updated `App.jsx` with Settings route

## 🎉 Ready to Use!

Your notification system is now ready. Start by configuring your preferences in the Settings page, then create alerts and watch the notifications roll in!
