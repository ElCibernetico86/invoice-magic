# Cloud Backup Setup (Firebase — free)

Invoice Magic can back up every user's invoices, estimates, clients, payments,
and settings to the cloud using **Firebase**, Google's app platform. The free
"Spark" plan is more than enough for this app (1 GB storage, 50,000 reads and
20,000 writes per day) and does **not** require a credit card.

You do this setup **once** as the app owner. After that, every user of your app
can create their own account in **Settings → Cloud Backup** and their data is
private to them.

## 1. Create the Firebase project (~3 min)

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**, name it (e.g. `invoice-magic`), and continue.
   You can turn off Google Analytics — it's not needed.

## 2. Turn on sign-in methods (~2 min)

1. In the left sidebar: **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Google** — pick a support email when
   asked, then save. This powers the "Continue with Google" button.
3. (Recommended) Also enable **Email/Password** so users without a Google
   account can still sign in with the email form.

## 3. Create the database (~2 min)

1. Sidebar: **Build → Firestore Database → Create database**.
2. Choose a location close to your users (e.g. `us-central`), and start in
   **production mode**.
3. Open the **Rules** tab, replace everything with the rules below, and
   click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each signed-in user can only read/write their own data
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

These rules are what keep each user's data private — don't skip them.

## 4. Get your web app config (~2 min)

1. Click the **gear icon → Project settings** (top of the sidebar).
2. Under **Your apps**, click the **</>** (Web) icon, give it any nickname,
   and click **Register app** (no need for Firebase Hosting).
3. Firebase shows a `firebaseConfig` code block. Copy the values into
   **`js/firebase-config.js`** in this project, replacing the `PASTE_...`
   placeholders:

```js
window.FIREBASE_CONFIG = {
    apiKey: 'AIza...',
    authDomain: 'invoice-magic-xxxxx.firebaseapp.com',
    projectId: 'invoice-magic-xxxxx',
    storageBucket: 'invoice-magic-xxxxx.appspot.com',
    messagingSenderId: '1234567890',
    appId: '1:1234567890:web:abc123',
};
```

> This config is safe to ship publicly — it identifies your project but does
> not grant access. Security comes from the rules in step 3.

## 5. Authorize your domain (~1 min)

Under **Authentication → Settings → Authorized domains**, make sure the domain
you serve the app from is listed. `localhost` is pre-authorized, so local
testing works out of the box. Add your real domain when you deploy — Google
sign-in refuses to open on domains that aren't on this list.

## Done — how it works for users

- **Settings → Cloud Backup**: create an account (email + password) or sign in.
- **Auto Backup** (on by default): every change is backed up ~8 seconds later.
- **Back Up Now / Restore**: manual controls. Restore replaces the device's
  data with the cloud copy.
- **New device**: sign in on the new device — if it's empty and the account
  has a backup, the app offers to restore it automatically.
- Offline use is unaffected; backups simply run the next time a change is made
  while online.

## Costs

The free plan covers thousands of typical users of an app like this. If you
ever outgrow it, the pay-as-you-go "Blaze" plan bills only for usage over the
free quota — for this app's data sizes that is pennies per month.
