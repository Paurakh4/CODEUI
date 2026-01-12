# Specification: User Authentication Flow

## 1. Overview
Implement a secure and user-friendly authentication flow using NextAuth.js with Google as the primary provider. This includes creating a sign-in dialog, protecting routes, and managing user sessions.

## 2. User Stories
- As a user, I want to sign in with my Google account so that I can access my saved projects and settings.
- As a user, I want to see a sign-in modal when I attempt to access restricted features.
- As a user, I want to easily sign out of my account.

## 3. Functional Requirements
- **Authentication Provider:** Google (via NextAuth.js).
- **Sign-In UI:** A modal dialog triggered from the sidebar or top nav when not authenticated.
- **Session Management:** Persistent sessions using NextAuth.js session callbacks.
- **Protected Routes:** Middleware to redirect unauthenticated users from protected pages (e.g., dashboard).
- **User Profile:** Display user avatar and name in the UI upon successful login.

## 4. Non-Functional Requirements
- **Security:** Secure handling of API keys and tokens.
- **Performance:** Minimal latency during sign-in/sign-out.
- **UX:** Clear error messages if authentication fails.

## 5. Technical Constraints
- Must use `next-auth` (v5 beta as per package.json)
- Must integrate with existing `shadcn/ui` components (Dialog, Button, etc.).
