export type Tier = "smb" | "mid-market" | "enterprise";

export type RecommendationInput = {
  acv?: string;
  cycleLengthDays?: string;
  stakeholderCount?: string;
  targetCustomerSize?: string;
  procurementInvolved?: string;
  motion?: string;
  hasSalesManager?: string;
};

export type Recommendation = {
  tier: Tier;
  founderLed: boolean;
  hasSalesManager: boolean;
};

/**
 * Deterministic tier scoring, not an AI guess — matches the platform's
 * "structured inputs over free text" principle (plan §1). Four factors
 * each score 0 (SMB-like) / 1 (mid-market-like) / 2 (enterprise-like); the
 * average buckets into a tier. Procurement involvement is a known strong
 * enterprise tell independent of deal size, so it only ever bumps the tier
 * UP, never down — underestimating complexity is the worse failure mode
 * (per the same reasoning as merge_by_key's "never silently lose data").
 *
 * Bands mirror the content/tracks/*.yml descriptions — if those change,
 * this must change with them.
 */
export function recommendTrack(input: RecommendationInput): Recommendation {
  const acv = Number(input.acv ?? 0);
  const cycleLengthDays = Number(input.cycleLengthDays ?? 0);
  const stakeholderCount = Number(input.stakeholderCount ?? 0);

  const acvScore = acv <= 20_000 ? 0 : acv <= 75_000 ? 1 : 2;
  const cycleScore = cycleLengthDays <= 30 ? 0 : cycleLengthDays <= 90 ? 1 : 2;
  const stakeholderScore = stakeholderCount <= 2 ? 0 : stakeholderCount <= 4 ? 1 : 2;
  const targetSizeScore =
    input.targetCustomerSize === "large" ? 2 : input.targetCustomerSize === "mid_size" ? 1 : 0;

  const average = (acvScore + cycleScore + stakeholderScore + targetSizeScore) / 4;
  const procurementInvolved = input.procurementInvolved === "yes";

  let tier: Tier = average >= 1.5 ? "enterprise" : average >= 0.75 ? "mid-market" : "smb";

  if (procurementInvolved) {
    if (tier === "smb") tier = "mid-market";
    else if (tier === "mid-market" && average >= 1.25) tier = "enterprise";
  }

  return {
    tier,
    founderLed: input.motion === "founder_led",
    hasSalesManager: input.hasSalesManager === "yes",
  };
}

/** The full set of track slugs whose content a user should see — their tier plus any cross-cutting modifiers that apply. */
export function applicableTracks(rec: Recommendation): string[] {
  return [
    rec.tier,
    ...(rec.founderLed ? ["founder-led"] : []),
    ...(rec.hasSalesManager ? ["sales-leadership"] : []),
  ];
}
