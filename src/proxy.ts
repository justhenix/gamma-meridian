import { NextResponse, type NextRequest } from "next/server";
import { paraglideMiddleware } from "@/paraglide/server.js";

export async function proxy(request: NextRequest) {
  return await paraglideMiddleware(request, async ({ locale }) => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-language-tag", locale);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
