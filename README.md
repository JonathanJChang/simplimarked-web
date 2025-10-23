# SimpliMarked - Payment Tracker

A simple real-time payment tracker for weekly sport signups, built with React and Firebase.

## Features

- 📝 Parse signup lists with automatic name extraction
- ✅ Real-time payment status tracking
- 🔄 Shared session - all users see the same data
- 📊 Live statistics (paid/unpaid counts)
- 🎨 Clean, modern UI inspired by Splitsies

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Realtime Database**:
   - In Firebase Console, go to "Build" → "Realtime Database"
   - Click "Create Database"
   - Choose location and start in **test mode** (for development)
4. Get your Firebase configuration:
   - Go to Project Settings (gear icon) → General
   - Scroll to "Your apps" section
   - Click the web icon (</>) to add a web app
   - Copy the `firebaseConfig` object

5. Update `src/firebase.js` with your Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Run the App

```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## How to Use

1. **Paste your signup list** in the text area
2. **Click "Parse"** to extract names and payment status
3. **Toggle payment status** by clicking the PAID/UNPAID buttons
4. All changes sync in real-time across all connected devices!

## Signup Format

The parser understands these formats:

- `(M)` - Member (automatically marked as paid)
- `(M)*` - Converting member (needs to pay conversion fee)
- No marker - Drop-in (needs to pay)

Example:
```
*October 26th Signup*
1. Jen (M)
2. bob    (M)*
3.   haryy
4. tim w (m)*
```

## Development

Built with:
- React 18
- Firebase Realtime Database
- Modern CSS with gradients and animations

## Future Enhancements

- [ ] Add user authentication
- [ ] Multiple session support (create/join by code)
- [ ] Export payment history
- [ ] Dark mode
- [ ] Push notifications for payment updates

