import BillingForm from "@/components/BillingForm";
import { getUserSubscriptionPlan } from "@/lib/stripe";

/**
 * Retrieves the user's current subscription plan and renders the BillingForm
 * component with the plan as a prop.
 * @returns The rendered BillingForm component.
 */
const Page = async () => {
  const subscriptionPlan = await getUserSubscriptionPlan();
  return <BillingForm subscriptionPlan={subscriptionPlan} />;
};

export default Page;
