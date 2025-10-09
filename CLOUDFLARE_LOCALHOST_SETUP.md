# Connect to Cloudflare from Localhost

Your app is now ready to connect to Cloudflare D1 and KV from your local development environment!

## Current Setup

✅ Account ID: `a839091de5f604a6c1cce4f98abe8c4c` (already in .env.local)  
✅ Database ID: `f0a3fa06-72f6-4463-aab0-a8a2685d040a` (already in .env.local)  
✅ KV Namespace ID: `b587e9a7f15245d8bc0333047e1d01d9` (already in .env.local)  
⏳ API Token: You need to create this

## Create Your API Token

1. **Visit Cloudflare Dashboard:**
   ```
   https://dash.cloudflare.com/profile/api-tokens
   ```

2. **Click "Create Token"**

3. **Select "Create Custom Token"**

4. **Configure Token:**
   - **Token name:** `Domus Local Development`
   - **Permissions:**
     - Account > D1 > Edit
     - Account > Workers KV Storage > Edit
   - **Account Resources:** Include > Your Account
   - **TTL:** No expiration (or set your preference)

5. **Create Token**
   - Copy the token immediately (you'll only see it once!)

6. **Add to .env.local:**
   Open `.env.local` and uncomment/update the line:
   ```bash
   CLOUDFLARE_API_TOKEN=your_token_here
   ```

## How It Works

The app automatically detects which environment it's in:

1. **Cloudflare Pages** (production): Uses native D1/KV bindings
2. **Localhost with API token**: Connects to real Cloudflare D1/KV via REST API
3. **Localhost without API token**: Uses in-memory storage (no cloud sync)

## Test Cloud Sync

After adding your API token:

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Check the console** - you should see:
   ```
   [Cloudflare] Using D1 REST API for localhost
   [Cloudflare] Using KV REST API for localhost
   ```

3. **Try the sync features:**
   - Register a user via the app
   - Make some changes to data
   - Click the sync button in the navigation
   - Check your Cloudflare dashboard to see the data!

## Verify Data in Cloudflare

**Check D1 Database:**
```bash
wrangler d1 execute domus_db --remote --command "SELECT * FROM users"
```

**Check KV Storage:**
```bash
wrangler kv:key list --namespace-id=b587e9a7f15245d8bc0333047e1d01d9
```

## Troubleshooting

**"Using in-memory fallback" message:**
- Make sure your API token is uncommented in `.env.local`
- Restart the dev server after adding the token

**"Unauthorized" errors:**
- Check that your API token has D1 and KV Edit permissions
- Make sure the token hasn't expired

**Data not syncing:**
- Check the browser console for API errors
- Verify your Account ID and Database/KV IDs are correct

## What's Stored Where

**Local IndexedDB:**
- All your data (works offline)
- Primary data source
- Changes tracked for sync

**Cloudflare D1:**
- User accounts
- Sync metadata
- Cross-device data

**Cloudflare KV:**
- Session tokens (JWT)
- 7-day expiration

## Next Steps

Once cloud sync is working on localhost:
- Deploy to Vercel or Cloudflare Pages
- Your app will work seamlessly in both environments
- Data syncs across all devices!

---

**Need help?** Check the Cloudflare docs:
- D1: https://developers.cloudflare.com/d1
- KV: https://developers.cloudflare.com/kv
- API Tokens: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
