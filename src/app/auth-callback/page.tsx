"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "../_trpc/client";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

/**
 * Page content for the auth callback page.
 *
 * This page is shown while we wait for the auth callback to complete.
 *
 * If the callback is successful, we redirect to the dashboard or
 * the original URL if `origin` is provided in the search params.
 *
 * If the callback fails, we redirect to the sign-in page.
 */
const AuthCallbackContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get("origin");

  trpc.authCallback.useQuery(undefined, {
    /**
     * If the callback is successful, redirect to the dashboard or the original URL
     * if `origin` is provided in the search params.
     * @param {{ success: boolean }} data The response data from the auth callback
     */
    onSuccess: ({ success }) => {
      if (success) {
        // user is synced to db
        router.push(origin ? `/${origin}` : "/dashboard");
      }
    },
    /**
     * If the callback fails, redirect to the sign-in page if the error code is
     * "UNAUTHORIZED".
     * @param {import("trpc").TRPCError} err The error from the auth callback
     */
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
    retry: true,
    retryDelay: 500,
  });

  return (
    <div className="w-full mt-24 flex justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-800" />
        <h3 className="font-semibold text-xl">Setting up your account...</h3>
        <p>You will be redirected automatically.</p>
      </div>
    </div>
  );
};

/**
 * Page component for the auth callback route.
 *
 * Suspends until the auth callback query finishes and renders the
 * AuthCallbackContent component.
 *
 * If the query fails with an "UNAUTHORIZED" error, redirects to the sign-in page.
 *
 * If the query succeeds, redirects to the dashboard or the original URL if
 * origin is provided in the search params.
 */
const Page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
};

export default Page;
