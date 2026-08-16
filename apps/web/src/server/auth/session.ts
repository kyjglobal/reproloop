import { getServerSession } from "next-auth";

import { getAuthOptions } from "./auth-options";

export function getCurrentSession() {
  return getServerSession(getAuthOptions());
}
