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
    "icp.segments",
    "company.buyer_title",
    "company.recommended_tier",
    "org.brand.logo",
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
  // Customer bucket applies to everyone regardless of has_existing_motion —
  // a zero-to-one founder still has a target market and expected deal
  // shape, unlike Team/Metrics which need real headcount/funnel history to
  // mean anything.
  const icpSegments = Array.isArray(context["icp.segments"]) ? context["icp.segments"] : [];
  const customerDone = icpSegments.length > 0 && typeof context["company.buyer_title"] === "string";
  // recommended_tier only gets written once saveDealShape's recommendTrack
  // call runs — its presence is the single completion signal for the whole
  // deal-shape screen, same idea as onboarding-diagnostic's old completion
  // trigger, just moved here (see that file's header comment).
  const dealShapeDone =
    typeof context["company.recommended_tier"] === "string" && context["company.recommended_tier"] !== "";
  // Every org.brand.* field is optional (see namespace comment) — presence
  // of the key, not a non-empty value, is what "done" means here, same
  // reasoning as teamDone above. All six are always written together by
  // saveBrand, so checking just one is enough.
  const brandDone = "org.brand.logo" in context;

  if (
    businessDone &&
    roleDone &&
    experienceDone &&
    motionDone &&
    teamDone &&
    metricsDone &&
    customerDone &&
    dealShapeDone &&
    brandDone
  )
    redirect("/journey");

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
            : !metricsDone
              ? "metrics"
              : !customerDone
                ? "customer"
                : !dealShapeDone
                  ? "deal-shape"
                  : "brand";

  return (
    <OnboardingFlow
      initialStep={initialStep}
      businessDone={businessDone}
      roleDone={roleDone}
      experienceDone={experienceDone}
      motionDone={motionDone}
      teamDone={teamDone}
      metricsDone={metricsDone}
      customerDone={customerDone}
      dealShapeDone={dealShapeDone}
      brandDone={brandDone}
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
