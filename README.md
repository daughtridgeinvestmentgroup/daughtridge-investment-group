# Daughtridge Investment Group LLC — Website

Frontend for GitHub. Backend is **Firebase** (Authentication + Firestore).

## 1. Put this project on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Create a repository named `daughtridge-investment-group`
3. Upload this folder (or use GitHub Desktop / `git push`)

## 2. Create the Firebase backend

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Add a project (example name: `daughtridge-site`)
3. Build → **Authentication** → Get started → enable **Email/Password**
4. Build → **Firestore Database** → Create database → start in **production mode**
5. Project settings (gear) → Your apps → **Web** (`</>`) → register app
6. Copy the firebaseConfig keys into a file named `.env` (see `.env.example`)

Then in Firestore, open **Rules** and paste the contents of `firestore.rules`, then Publish.

## 3. Run locally

```bash
npm install
npm run dev
```

- Public site: Home, About Us, Join Now, Contact Us
- Owner dashboard: open `#/admin` or the Owner login link in the footer
- First visit: **Create account** with `Daughtridgeinvestmentgroup@gmail.com`
- JOIN NOW saves to Firestore collection `inquiries`

## 4. Publish the site (free Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

Firebase will give you a link like:

`https://your-project-id.web.app`

## 5. Custom domain later

In Firebase Hosting → **Add custom domain** → enter the domain you purchase (GoDaddy, Namecheap, Google Domains, etc.) and follow the DNS steps.

---

Owner email: `Daughtridgeinvestmentgroup@gmail.com`
