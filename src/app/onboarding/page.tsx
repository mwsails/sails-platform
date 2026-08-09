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
    "company.has_existing_motion",
    "team.current_roles",
    "metrics.lead_sources",
  ]);

  // Forced order (Business, then You, then Sales Motion) — respondent.role
  // has to be known before the has_existing_motion fork could even matter
  // (a rep vs. a founder answering it means different things), and the
  // fork itself has to be known before Metrics, since "no" skips Metrics
  // entirely — a target the user invented can't diagnose itself.
  const businessDone = typeof context["company.name"] === "string" && context["company.name"] !== "";
  const roleDone = typeof context["respondent.role"] === "string" && context["respondent.role"] !== "";
  const experienceDone =
    typeof context["respondent.sales_experience"] === "string" && context["respondent.sales_experience"] !== "";
  const hasExistingMotion = context["company.has_existing_motion"] as string | undefined;
  const motionDone = hasExistingMotion === "yes" || hasExistingMotion === "no";
  // Presence, not length — someone with a real existing motion can
  // legitimately have zero headcount in any listed role (a founder who's
  // closed real deals but hasn't hired yet), so an empty array is a valid,
  // completed answer here, unlike Metrics below where the confirm button
  // itself is disabled until at least one source has data.
  const teamDone = hasExistingMotion === "no" || "team.current_roles" in context;
  const leadSources = Array.isArray(context["metrics.lead_sources"]) ? context["metrics.lead_sources"] : [];
  // "No" skips Metrics outright — nothing to defer or fill in for a
  // zero-to-one founder. Re-deferring on reload (rather than remembering a
  // prior defer) is an acceptable edge case, not a real resume bug — it
  // just means asking again, not losing anything.
  const metricsDone = hasExistingMotion === "no" || leadSources.length > 0;

  if (businessDone && roleDone && experienceDone && motionDone && teamDone && metricsDone) redirect("/journey");

  const initialStep = !businessDone
    ? "business"
    : !roleDone
      ? "role"
      : !experienceDone
        ? "experience"
        : !motionDone
          ? "motion"
          : !teamDone
            ? "team"
            : "metrics";

  return (
    <OnboardingFlow
      initialStep={initialStep}
      businessDone={businessDone}
      roleDone={roleDone}
      experienceDone={experienceDone}
      motionDone={motionDone}
      teamDone={teamDone}
      metricsDone={metricsDone}
      hasExistingMotion={hasExistingMotion === "yes" || hasExistingMotion === "no" ? hasExistingMotion : null}
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
