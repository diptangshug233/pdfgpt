"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { trpc } from "@/app/_trpc/client";

/**
 * @description
 * Creates a trpc hook for upgrading a user to a paid plan.
 * Redirects user to the billing page if the mutation is successful.
 * @returns {JSX.Element} A button with an arrow pointing right.
 */
const UpgradeButton = () => {
  const { mutate: createStripeSession } = trpc.createStripeSession.useMutation({
    /**
     * Redirects user to the billing page if the mutation is successful.
     * The billing page is located at either the provided `url` or
     * `/dashboard/billing` if no `url` is provided.
     */
    onSuccess: ({ url }) => {
      window.location.href = url ?? "/dashboard/billing";
    },
  });
  return (
    <Button className="w-full" onClick={() => createStripeSession()}>
      Upgrade now <ArrowRight className="h-5 w-5 ml-1.5" />
    </Button>
  );
};

export default UpgradeButton;
