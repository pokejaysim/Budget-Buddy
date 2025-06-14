# Budget Buddy - Personal Expense Tracker

A lightning-fast, mobile-first expense tracking web app with real-time sync across devices.

## Features

- **Quick Entry**: 3-second expense entry workflow
- **Dual Card Support**: Track expenses for Neo Credit Card and RBC Credit Card
- **Categories**: Food, Delivery, Groceries, Shopping, Entertainment, Other
- **Real-time Sync**: Instant synchronization across all your devices
- **Offline Support**: Works offline with automatic sync when back online
- **Data Management**: View, edit, and delete expenses with search and filtering
- **Analytics**: Category breakdowns and spending summaries
- **Export**: Download your data as CSV
- **PWA**: Install as a mobile app for quick access

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter a project name (e.g., "budget-buddy")
4. Enable Google Analytics (optional)
5. Wait for project creation to complete

### 2. Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Enable "Google" as a sign-in provider
4. Add your domain to authorized domains

### 3. Set up Firestore Database

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your preferred location
5. The security rules are already configured in `firestore.rules`

### 4. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click on web icon (</>) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 5. Update Configuration

Replace the placeholder values in `firebase-config.js` with your actual Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

### 6. Update Project ID

Update `.firebaserc` with your project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### 7. Deploy to Firebase Hosting

Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
```

Login to Firebase:
```bash
firebase login
```

Deploy the app:
```bash
firebase deploy
```

Your app will be available at:
- `https://your-project-id.web.app`
- `https://your-project-id.firebaseapp.com`

## Local Development

To run locally, you can use any static file server:

Using Python:
```bash
python -m http.server 8000
```

Using Node.js:
```bash
npx serve
```

## PWA Icons

To complete the PWA setup, add these icon files:
- `icon-192.png` - 192x192px app icon
- `icon-512.png` - 512x512px app icon

## Usage

1. Sign in with your Google account
2. Select a credit card (RBC is default)
3. Enter the expense amount
4. Select a category
5. Optionally add a description
6. Click "SAVE EXPENSE"

The form stays open for rapid multi-entry. Your expenses sync instantly across all devices.

## Security

- Users can only access their own expenses
- All data is encrypted in transit
- Authentication is handled by Google OAuth
- Firestore security rules ensure data isolation

## Browser Support

- Chrome/Edge (latest)
- Safari (latest)
- Firefox (latest)
- Mobile browsers with PWA support