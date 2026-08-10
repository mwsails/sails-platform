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

const BRAND_KEYS = [
  "org.brand.logo",
  "org.brand.color_primary",
  "org.brand.color_secondary",
  "org.brand.color_accent",
  "org.brand.font_heading",
  "org.brand.font_body",
];

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const context = await readContext(supabase, user.orgId, user.id, [
    ...BUSINESS_KEYS,
    ...BRAND_KEYS,
    "respondent.role",
    "respondent.sales_experience",
    "company.has_existing_motion",
    "team.current_roles",
    "icp.segments",
    "company.buyer_title",
    "metrics.lead_sources",
    "metrics.deferred",
    "company.recommended_tier",
  ]);

  // Forced order (Business, then You, then Sales Motion) — respondent.role
  // has to be known before the has_existing_motion fork could even matter
  // (a rep vs. a founder answering it means different things), and the
  // fork itself has to be known before Your funnel, since "no" skips it
  // entirely — a target the user invented can't diagnose itself. Customer
  // ("Who you sell to") now runs before Your funnel so
  // company.target_customer_size is already known once the funnel screen
  // needs to compute a tier — see saveLeadSources' doc comment.
  //
  // Business and Brand are one merged screen (BusinessStep) — brand kit
  // fields are proposed from the same scrape as the business fields, so
  // there's no separate brandDone; the screen isn't done until both
  // saveBusiness and saveBrand have run, which happen together on confirm.
  const businessDone =
    typeof context["company.name"] === "string" &&
    context["company.name"] !== "" &&
    "org.brand.logo" in context;
  const roleDone = typeof context["respondent.role"] === "string" && context["respondent.role"] !== "";
  const experienceDone =
    typeof context["respondent.sales_experience"] === "string" && context["respondent.sales_experience"] !== "";
  const hasExistingMotion = context["company.has_existing_motion"] as string | undefined;
  const motionDone = hasExistingMotion === "yes" || hasExistingMotion === "no";
  // Presence, not length — someone with a real existing motion can
  // legitimately have zero headcount in any listed role (a founder who's
  // closed real deals but hasn't hired yet), so an empty array is a valid,
  // completed answer here, unlike Your funnel below where the confirm
  // button itself is disabled until at least one source has data.
  const teamDone = hasExistingMotion === "no" || "team.current_roles" in context;
  // Customer bucket applies to everyone regardless of has_existing_motion —
  // a zero-to-one founder still has a target market and expected deal
  // shape, unlike Team/Your funnel which need real headcount/funnel
  // history to mean anything.
  const icpSegments = Array.isArray(context["icp.segments"]) ? context["icp.segments"] : [];
  const customerDone = icpSegments.length > 0 && typeof context["company.buyer_title"] === "string";
  const leadSources = Array.isArray(context["metrics.lead_sources"]) ? context["metrics.lead_sources"] : [];
  const hasFunnelData = leadSources.length > 0;
  // "No" skips Your funnel outright, and a defer counts as done too (see
  // metrics.deferred's namespace comment) — re-deferring on reload rather
  // than remembering a prior defer would be a real resume bug here, unlike
  // the old behavior before that field existed.
  const metricsDone = hasExistingMotion === "no" || hasFunnelData || context["metrics.deferred"] === "yes";
  // company.recommended_tier gets written by whichever of Your funnel
  // (real data) or Deal Shape (fallback) runs — its presence is the single
  // completion signal for both, so Deal Shape is naturally skipped in the
  // has-real-data case without any extra bookkeeping here.
  const dealShapeDone =
    typeof context["company.recommended_tier"] === "string" && context["company.recommended_tier"] !== "";

  if (businessDone && roleDone && experienceDone && motionDone && teamDone && customerDone && metricsDone && dealShapeDone)
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
            : !customerDone
              ? "customer"
              : !metricsDone
                ? "metrics"
                : "deal-shape";

  return (
    <OnboardingFlow
      initialStep={initialStep}
      businessDone={businessDone}
      roleDone={roleDone}
      experienceDone={experienceDone}
      motionDone={motionDone}
      teamDone={teamDone}
      customerDone={customerDone}
      metricsDone={metricsDone}
      dealShapeDone={dealShapeDone}
      hasFunnelData={hasFunnelData}
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
      initialBrand={{
        logo: (context["org.brand.logo"] as string) ?? "",
        color_primary: (context["org.brand.color_primary"] as string) ?? "",
        color_secondary: (context["org.brand.color_secondary"] as string) ?? "",
        color_accent: (context["org.brand.color_accent"] as string) ?? "",
        font_heading: (context["org.brand.font_heading"] as string) ?? "",
        font_body: (context["org.brand.font_body"] as string) ?? "",
      }}
    />
  );
}
