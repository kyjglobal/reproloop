import type { NextRequest } from "next/server";
import NextAuth from "next-auth";

import { getAuthOptions } from "@/server/auth/auth-options";

interface AuthRouteContext {
  params: Promise<{ nextauth: string[] }>;
}

function handler(request: NextRequest, context: AuthRouteContext) {
  return NextAuth(request, context, getAuthOptions());
}

export { handler as GET, handler as POST };
