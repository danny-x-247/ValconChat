# SchoolChat

A real-time schoolmate chat web application.

## Features
- Email/password accounts
- Display names
- Search classmates
- One-to-one real-time chat
- Messages stored in Firestore
- Message timestamps
- Profile editing
- Mobile-friendly interface
- Firebase Authentication + Firestore security rules

## Setup

### 1. Create a Firebase project
Go to Firebase Console:
https://console.firebase.google.com/

Create a new project.

### 2. Enable Authentication
Firebase Console → Authentication → Sign-in method → Email/Password → Enable.

### 3. Create Firestore
Firebase Console → Firestore Database → Create database.

### 4. Add your Firebase web configuration
Firebase Console → Project settings → Your apps → Web app.

Copy the Firebase configuration into `script.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 5. Add Firestore Rules
Open `firebase-rules.txt` and paste the rules into:
Firestore Database → Rules

### 6. Run it
Because this project uses Firebase modules, open it through a web server or deploy it to GitHub Pages, Cloudflare Pages, Firebase Hosting, etc.

You can also test locally with VS Code Live Server.

## Important
This project intentionally does not include real Firebase credentials. Each school/project should use its own Firebase project.

For a larger school community, add:
- School/class verification
- Admin accounts
- Report/block tools
- Moderation
- Group chats
- File/image sharing
- Password reset
- Email verification
- Rate limiting / abuse protection
