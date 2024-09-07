"use client";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { useToast } from "./ui/use-toast";
import { trpc } from "@/app/_trpc/client";
import MaxWidthWrapper from "./MaxWidthWrapper";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface BillingFormProps {
  subscriptionPlan: Awaited<ReturnType<typeof getUserSubscriptionPlan>>;
}

/**
 * Renders a form that allows users to manage their subscription plan.
 *
 * @param {BillingFormProps} props The component props.
 * @param {Awaited<ReturnType<typeof getUserSubscriptionPlan>>} props.subscriptionPlan
 *   The user's subscription plan. This is passed as a prop from the parent component.
 *
 * @returns A JSX element that renders a form with a card containing a title, description,
 *   and a button that triggers the trpc.createStripeSession mutation when clicked.
 *   The button's text will be "Manage Subscription" if the user is subscribed, or
 *   "Upgrade to PRO" if the user is not subscribed.
 *   If the user is subscribed, the card will also contain a small text that displays
 *   when the plan will be cancelled or renewed.
 */
const BillingForm = ({ subscriptionPlan }: BillingFormProps) => {
  const { toast } = useToast();

  const { mutate: createStripeSession, isLoading } =
    trpc.createStripeSession.useMutation({
      /**
       * Redirects user to the billing page if the mutation is successful.
       * The billing page is located at either the provided `url` or
       * `/dashboard/billing` if no `url` is provided.
       *
       * If the mutation is not successful, it will display a toast with a
       * "destructive" variant and a description saying "Please try again in a moment".
       */
      onSuccess: ({ url }) => {
        if (url) window.location.href = url;
        if (!url) {
          toast({
            title: "There was a problem...",
            description: "Please try again in a moment",
            variant: "destructive",
          });
        }
      },
    });

  return (
    <MaxWidthWrapper className="max-w-5xl">
      <form
        className="mt-12"
        onSubmit={(e) => {
          e.preventDefault();
          createStripeSession();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>
              You are currently on the <strong>{subscriptionPlan.name}</strong>{" "}
              plan.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
            <Button type="submit">
              {isLoading ? (
                <Loader2 className="mr-4 h-4 w-4 animate-spin" />
              ) : null}
              {subscriptionPlan.isSubscribed
                ? "Manage Subscription"
                : "Upgrade to PRO"}
            </Button>
            {subscriptionPlan.isSubscribed ? (
              <p className="rounded-full text-xs font-medium">
                {subscriptionPlan.isCanceled
                  ? "Your plan will be cancelled on "
                  : "Your plan renews on "}
                {format(subscriptionPlan.stripeCurrentPeriodEnd!, "dd.MM.yyyy")}
                .
              </p>
            ) : null}
          </CardFooter>
        </Card>
      </form>
    </MaxWidthWrapper>
  );
};

export default BillingForm;
