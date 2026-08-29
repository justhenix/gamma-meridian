import { NextResponse, type NextRequest } from "next/server";
import { paraglideMiddleware } from "@/paraglide/server.js";

export async function proxy(request: NextRequest) {
  return await paraglideMiddleware(request, async () => {
    return NextResponse.next();
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
