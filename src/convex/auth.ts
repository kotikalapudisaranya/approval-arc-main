// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

// Email + password provider (used for applicant / department / admin logins,
// including the clearly-labelled demo accounts). Passwords are hashed with
// Scrypt by the provider; only the hash is stored in authAccounts.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({ reset: emailOtp }),
    emailOtp,
    Anonymous,
  ],
});