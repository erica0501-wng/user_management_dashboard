# Notification System Setup Guide

This guide will help you set up the notification system for email, Telegram, and Discord alerts.

## 📧 Email Notifications

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Sign in to your Google account
   - Select "Mail" and your device
   - Click "Generate"
   - Copy the 16-character password

3. **Configure Environment Variables**:
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-16-character-app-password"
   SMTP_FROM="Polymarket Alerts <your-email@gmail.com>"
   ```

### Other Email Providers

For other email providers, use their SMTP settings:

**Outlook/Hotmail:**
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
```

**Yahoo Mail:**
```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
```

## 🤖 Telegram Bot Setup

1. **Create a Telegram Bot**:
   - Open Telegram and search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot` command
   - Follow the prompts to create your bot
   - You'll receive a token like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

2. **Configure Environment Variable**:
   ```env
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   ```

3. **Get Your Chat ID**:
   - Start a chat with your bot
   - Send `/start` command
   - The bot should reply with your Chat ID
   - Copy this ID and enter it in the Settings page

### Creating the Bot Response (Optional)

To make your bot respond with the chat ID, you can create a simple webhook or polling script. For now, you can use [@userinfobot](https://t.me/userinfobot) to get your chat ID:
1. Search for @userinfobot on Telegram
2. Start a chat and send any message
3. The bot will reply with your user info including your ID

## 💬 Discord Webhook Setup

1. **Open Discord Server Settings**:
   - Right-click on your Discord server
   - Select "Server Settings"

2. **Create a Webhook**:
   - Go to "Integrations" → "Webhooks"
   - Click "New Webhook" or "Create Webhook"
   - Give it a name (e.g., "Polymarket Alerts")
   - Select the channel where alerts should be posted
   - Click "Copy Webhook URL"

3. **Configure in Settings Page**:
   - Go to Settings page in the app
   - Enable Discord notifications
   - Paste the webhook URL
   - Test the connection

The webhook URL format:
```
https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz
```

## 🔄 Migration

After configuring environment variables, run the Prisma migration to update the database schema:

```bash
cd backend
npx prisma migrate dev --name add_notification_settings
```

## ✅ Testing

1. **Start the backend server**:
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Access the Settings page**:
   - Navigate to `/settings` in your app
   - Configure your notification channels
   - Use the "Send Test Alert" button to verify

3. **Create an alert**:
   - Go to a Polymarket market
   - Create a price or order book alert
   - Select notification channels
   - Wait for the alert to trigger

## 🔒 Security Notes

- Never commit `.env` file to version control
- Use app-specific passwords for email
- Keep your Telegram bot token secret
- Discord webhooks are public if the URL is exposed - don't share them
- Rotate credentials regularly

## 📱 Notification Channels

Each alert can be sent to multiple channels:
- **Email**: Sent to the user's registered email
- **Telegram**: Instant message with market link
- **Discord**: Rich embed with market details and action button

Configure default channels in Settings, and override per-alert when creating.

## 🐛 Troubleshooting

### Email not sending
- Verify SMTP credentials
- Check if app password is used (for Gmail)
- Ensure 2FA is enabled
- Check server logs for errors

### Telegram not working
- Verify bot token is correct
- Ensure chat ID is from a conversation with your bot
- Start a conversation with the bot first
- Check if bot is blocked

### Discord not working
- Verify webhook URL format
- Check if webhook was deleted in Discord
- Ensure channel permissions allow webhooks
- Test with the "Send Test Message" button

## 📚 API Endpoints

- `GET /notifications/settings` - Get user notification settings
- `PUT /notifications/settings` - Update notification settings
- `POST /notifications/test` - Send test notification
- `POST /notifications/telegram/verify` - Verify Telegram bot
- `POST /notifications/discord/test` - Test Discord webhook
- `DELETE /notifications/telegram/disconnect` - Disconnect Telegram
- `DELETE /notifications/discord/disconnect` - Disconnect Discord
