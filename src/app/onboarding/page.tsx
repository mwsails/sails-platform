import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { OnboardingFlow } from "./OnboardingFlow";

const BUSINESS_KEYS = [
  "company.domain",
  "company.name",
  "company.what_you_sell",
  "company.category",
  "company.capabilities",
  "company.proof",
  "company.stage",
];

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const context = await readContext(supabase, user.orgId, user.id, [
    ...BUSINESS_KEYS,
    "respondent.role",
    "respondent.sales_experience",
  ]);

  // Forced order (Business, then You) — respondent.role has to be known
  // before the has_existing_motion fork on the next onboarding stop can
  // decide whether that question even applies to this person, same
  // reasoning as the design handoff's "You before Sales motion" rule.
  const businessDone = typeof context["company.name"] === "string" && context["company.name"] !== "";
  const roleDone = typeof context["respondent.role"] === "string" && context["respondent.role"] !== "";
  const experienceDone =
    typeof context["respondent.sales_experience"] === "string" && context["respondent.sales_experience"] !== "";

  if (businessDone && roleDone && experienceDone) redirect("/journey");

  const initialStep = !businessDone ? "business" : !roleDone ? "role" : "experience";

  return (
    <OnboardingFlow
      initialStep={initialStep}
      businessDone={businessDone}
      roleDone={roleDone}
      experienceDone={experienceDone}
      initialBusiness={{
        domain: (context["company.domain"] as string) ?? "",
        name: (context["company.name"] as string) ?? "",
        what_you_sell: (context["company.what_you_sell"] as string) ?? "",
        category: (context["company.category"] as string) ?? "",
        capabilities: (context["company.capabilities"] as string) ?? "",
        proof: (context["company.proof"] as string) ?? "",
        stage: (context["company.stage"] as string) ?? "",
      }}
    />
  );
}
