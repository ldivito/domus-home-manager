# Deployment Guide for Domus

This guide covers deploying the Domus app to Vercel with Dexie Cloud synchronization.

## Prerequisites

1. **Dexie Cloud Account**: Sign up at [dexie.cloud](https://dexie.cloud) to get your database URL
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) for hosting

## Setting Up Dexie Cloud

1. Visit [dexie.cloud](https://dexie.cloud) and create an account
2. Create a new database for your Domus app
3. Copy your database URL (it should look like `https://your-app.dexie.cloud`)
4. Note: Dexie Cloud handles user authentication, data synchronization, and permissions automatically

## Deploy to Vercel

### Method 1: Deploy with Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from your project directory:
   ```bash
   vercel
   ```

4. Set environment variables:
   ```bash
   vercel env add NEXT_PUBLIC_DEXIE_CLOUD_URL
   ```
   Enter your Dexie Cloud database URL when prompted.

5. Redeploy to apply environment variables:
   ```bash
   vercel --prod
   ```

### Method 2: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. In the environment variables section, add:
   - **Name**: `NEXT_PUBLIC_DEXIE_CLOUD_URL`
   - **Value**: Your Dexie Cloud database URL (e.g., `https://your-app.dexie.cloud`)
4. Deploy

## Environment Variables

The following environment variables need to be set in Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_DEXIE_CLOUD_URL` | Your Dexie Cloud database URL | `https://your-app.dexie.cloud` |

## Post-Deployment Setup

1. **Test Authentication**: Visit your deployed app and test the sign-in flow
2. **Create First Household**: The first user to sign in can create a household
3. **Invite Family Members**: Generate invite codes from the app to add family members
4. **Verify Sync**: Test that changes sync across multiple devices/browsers

## Features Available After Deployment

✅ **Multi-Device Sync**: Data automatically syncs across all devices
✅ **Family Sharing**: Multiple family members can access the same household
✅ **Real-time Updates**: Changes appear instantly on other devices
✅ **Offline Support**: App works offline, syncs when back online
✅ **Automatic Backups**: Dexie Cloud handles data backup and recovery

## Troubleshooting

### Authentication Issues
- Verify `NEXT_PUBLIC_DEXIE_CLOUD_URL` is set correctly in Vercel
- Check that your Dexie Cloud database is active
- Ensure the URL format is correct (https://your-app.dexie.cloud)

### Sync Problems
- Check browser network tab for Dexie Cloud connection errors
- Verify users are properly authenticated
- Ensure household setup is complete

### Performance
- Dexie Cloud automatically handles caching and performance
- IndexedDB stores data locally for offline access
- Sync only happens when changes are made

## Monitoring

You can monitor your app's usage in:
- **Vercel Dashboard**: Deployment status, build logs, and analytics
- **Dexie Cloud Console**: Database usage, sync status, and user activity
- **Browser Dev Tools**: IndexedDB data, sync events, and error logs

## Security

- All data is encrypted in transit with HTTPS
- Dexie Cloud handles user authentication securely
- Household-based data isolation ensures privacy
- No sensitive data is stored in environment variables
- Local IndexedDB provides offline data protection

## Cost Considerations

- **Vercel**: Free tier supports most family use cases
- **Dexie Cloud**: Free tier includes generous limits for personal/family use
- Both platforms offer paid tiers for advanced features if needed