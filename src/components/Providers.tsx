"use client";

import { PropsWithChildren, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc } from "@/app/_trpc/client";
import { httpBatchLink } from "@trpc/client";
import { absoluteUrl } from "@/lib/utils";

/**
 * Providers
 *
 * This component wraps your app in a QueryClient and TRPC client
 * so that they are available everywhere in your app.
 *
 * @param {{ children: ReactNode }} props
 * @returns {JSX.Element}
 */
const Providers = ({ children }: PropsWithChildren) => {
  const [queryCLient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: absoluteUrl("/api/trpc"),
        }),
      ],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryCLient}>
      <QueryClientProvider client={queryCLient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};

export default Providers;
