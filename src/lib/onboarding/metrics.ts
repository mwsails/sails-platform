/**
 * Shared by the client (live preview while typing) and the server action
 * (recomputed at write time — never trust the client's numbers for what
 * gets persisted). Counts and cycle length are the only inputs a person
 * ever types; every rate here is derived from them, so a typed rate can
 * never disagree with its own counts, because nothing ever types one.
 */

export type SourceInput = {
  source: string;
  leads: number;
  sets: number;
  meetings: number;
  opportunities: number;
  closed_won: number;
  arr: number;
  cycle_length_days: number;
};

export type SourceComputed = SourceInput & {
  set_rate: number;
  keep_rate: number;
  opp_rate: number;
  close_rate: number;
  arpa: number;
  velocity: number;
};

function safeDiv(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function computeSourceMetrics(input: SourceInput): SourceComputed {
  const set_rate = safeDiv(input.sets, input.leads);
  const keep_rate = safeDiv(input.meetings, input.sets);
  const opp_rate = safeDiv(input.opportunities, input.meetings);
  const close_rate = safeDiv(input.closed_won, input.opportunities);
  const arpa = safeDiv(input.arr, input.closed_won);
  // Sales velocity = (opportunities x average deal size x win rate) / cycle length.
  const velocity = safeDiv(input.opportunities * arpa * close_rate, input.cycle_length_days);
  return { ...input, set_rate, keep_rate, opp_rate, close_rate, arpa, velocity };
}

export type Blended = {
  totalLeads: number;
  totalSets: number;
  totalMeetings: number;
  totalOpportunities: number;
  totalClosedWon: number;
  totalArr: number;
  blendedCycleDays: number;
  setRate: number;
  keepRate: number;
  oppRate: number;
  closeRate: number;
  arpa: number;
  velocity: number;
};

/** Opportunity-weighted blended cycle length, not a straight mean across sources — a source with one opportunity shouldn't move the blend as much as one with fifty. */
export function computeBlended(sources: SourceComputed[]): Blended {
  const sum = (f: (s: SourceComputed) => number) => sources.reduce((acc, s) => acc + f(s), 0);

  const totalLeads = sum((s) => s.leads);
  const totalSets = sum((s) => s.sets);
  const totalMeetings = sum((s) => s.meetings);
  const totalOpportunities = sum((s) => s.opportunities);
  const totalClosedWon = sum((s) => s.closed_won);
  const totalArr = sum((s) => s.arr);

  const blendedCycleDays = safeDiv(
    sum((s) => s.cycle_length_days * s.opportunities),
    totalOpportunities
  );
  const setRate = safeDiv(totalSets, totalLeads);
  const keepRate = safeDiv(totalMeetings, totalSets);
  const oppRate = safeDiv(totalOpportunities, totalMeetings);
  const closeRate = safeDiv(totalClosedWon, totalOpportunities);
  const arpa = safeDiv(totalArr, totalClosedWon);
  const velocity = safeDiv(totalOpportunities * arpa * closeRate, blendedCycleDays);

  return {
    totalLeads,
    totalSets,
    totalMeetings,
    totalOpportunities,
    totalClosedWon,
    totalArr,
    blendedCycleDays,
    setRate,
    keepRate,
    oppRate,
    closeRate,
    arpa,
    velocity,
  };
}

export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "cold_outbound", label: "Cold outbound" },
  { value: "inbound", label: "Inbound" },
  { value: "referral", label: "Referral" },
  { value: "lost_opportunities", label: "Lost opportunities (recycled)" },
  { value: "partners", label: "Partners" },
  { value: "events", label: "Events & conferences" },
];
