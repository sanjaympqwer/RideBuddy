# Twilio environment variables for RideBuddy

Your Cloud Functions read Twilio config from **environment variables**. Set them in Google Cloud so they are never stored in code or git.

## Variable names (set these in Google Cloud)

| Variable name              | Description        |
|---------------------------|--------------------|
| `TWILIO_ACCOUNT_SID`      | Account SID (AC...) |
| `TWILIO_API_KEY_SID`     | API Key SID (SK...) |
| `TWILIO_API_KEY_SECRET`  | API Key Secret      |
| `TWILIO_TWIML_APP_SID`   | TwiML App SID (AP...) |

## Where to set them (choose one)

### Option A: Google Cloud Console (recommended)

1. Open **[Google Cloud Console](https://console.cloud.google.com)** and select project **rider-7ad2b**.
2. Go to **Cloud Run** (or **Cloud Functions** if you use 1st gen):  
   - **Cloud Run**: https://console.cloud.google.com/run?project=rider-7ad2b  
   - **Cloud Functions**: https://console.cloud.google.com/functions/list?project=rider-7ad2b  
3. Open each function that uses Twilio: **getTwilioToken** and **voiceTwiML**.
4. Click **Edit** (or **Edit & deploy new revision**).
5. Expand **Variables & secrets** (or **Runtime, build, connections and security** → **Variables**).
6. Add each variable:
   - `TWILIO_ACCOUNT_SID` = your Account SID
   - `TWILIO_API_KEY_SID` = your API Key SID
   - `TWILIO_API_KEY_SECRET` = your API Key Secret
   - `TWILIO_TWIML_APP_SID` = your TwiML App SID
7. Deploy the new revision.

### Option B: Firebase Local Emulator only (`.env`)

For **local testing only**, you can use a `.env` file in the `functions` folder.  
**Do not commit `.env`** (it should be in `.gitignore`).

1. In `functions` folder create `.env` with:
   ```
   TWILIO_ACCOUNT_SID=your_value
   TWILIO_API_KEY_SID=your_value
   TWILIO_API_KEY_SECRET=your_value
   TWILIO_TWIML_APP_SID=your_value
   ```
2. Load it when running the emulator (e.g. `dotenv` or run from a shell that exports these).

For **production**, always use Option A (Google Cloud environment variables).

## After setting

1. Redeploy if you set vars on existing functions:  
   `firebase deploy --only functions`
2. In **Twilio Console** → **Voice** → **TwiML Apps** → your app, set **Voice URL** to:  
   `https://us-central1-rider-7ad2b.cloudfunctions.net/voiceTwiML`

Then voice calling in the app will use your Twilio keys.
