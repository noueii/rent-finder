import NextAuth from "next-auth";
import { authOptions } from "~/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const baseHandler = NextAuth(authOptions);

// Wrap handler to add no-cache headers
const handler = async (req: NextRequest, context: any) => {
  const response = await baseHandler(req, context);
  
  // Add headers to prevent caching
  if (response instanceof NextResponse) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }
  
  return response;
};

export { handler as GET, handler as POST };