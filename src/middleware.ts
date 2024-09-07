import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextRequest } from "next/server";
/**
 * The default middleware for Next.js pages that need authentication.
 *
 * It uses the `withAuth` function from `@kinde-oss/kinde-auth-nextjs/middleware` to
 * handle authentication for the given request. By default, it will redirect the
 * user to the original page if authentication was successful.
 *
 * @param {NextRequest} req The request object.
 * @returns The response from the `withAuth` function.
 */
export default function middleware(req: NextRequest) {
  return withAuth(req, {
    isReturnToCurrentPage: true,
  });
}
export const config = {
  matcher: ["/dashboard/:path*", "/auth-callback"],
};
