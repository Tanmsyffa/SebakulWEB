/**
 * Proportional Greedy Debt Simplification Algorithm for SEBAKUL Guyub.
 *
 * Splitting is proportional to totalFee (which reflects adults + kids participant count).
 */

export interface WarungParticipantData {
  warungId: string;
  warungName: string;
  totalFee: number; // weight F_i
  totalExpensePaid: number; // E_i (talangan)
  adultCount: number;
  childCount: number;
}

export interface SplitResultTransfer {
  fromWarungId: string;
  fromWarungName: string;
  toWarungId: string;
  toWarungName: string;
  amount: number;
}

export interface SplitBillCalculationResult {
  totalExpense: number;
  totalFeeSum: number;
  shares: {
    warungId: string;
    warungName: string;
    adultCount: number;
    childCount: number;
    totalExpensePaid: number;
    fairShare: number;
    balance: number; // positive = creditor (terima), negative = debtor (bayar)
  }[];
  transfers: SplitResultTransfer[];
}

export function calculateProportionalSplit(
  participants: WarungParticipantData[],
  equalPerWarung = false
): SplitBillCalculationResult {
  if (participants.length === 0) {
    return {
      totalExpense: 0,
      totalFeeSum: 0,
      shares: [],
      transfers: [],
    };
  }

  // 1. Total expense T = sum(E_i)
  const totalExpense = participants.reduce((sum, p) => sum + p.totalExpensePaid, 0);

  // 2. Total weight F_total = sum(F_i)
  const totalFeeSum = participants.reduce((sum, p) => sum + p.totalFee, 0);

  if (totalExpense === 0) {
    return {
      totalExpense,
      totalFeeSum,
      shares: participants.map((p) => ({
        warungId: p.warungId,
        warungName: p.warungName,
        adultCount: p.adultCount,
        childCount: p.childCount,
        totalExpensePaid: p.totalExpensePaid,
        fairShare: 0,
        balance: p.totalExpensePaid,
      })),
      transfers: [],
    };
  }

  // Free events have no fee weights; use headcount so advances can settle.
  const weights = participants.map(p => equalPerWarung ? 1 : totalFeeSum > 0 ? p.totalFee : p.adultCount + p.childCount);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) throw new Error('Jumlah peserta untuk pembagian biaya tidak valid');

  // 3. Proportional fair share S_i = floor((F_i / F_total) * T)
  const useExactBigInt =
    Number.isInteger(totalExpense) &&
    Number.isInteger(weightSum) &&
    weights.every((weight) => Number.isInteger(weight));
  const rawShares = participants.map((p, index) => ({
    ...p,
    fairShare: useExactBigInt
      ? Number((BigInt(weights[index]) * BigInt(totalExpense)) / BigInt(weightSum))
      : Math.floor((weights[index] / weightSum) * totalExpense),
  }));

  // Distribute rounding remainder to the warung with highest F_i
  const sumShares = rawShares.reduce((sum, p) => sum + p.fairShare, 0);
  const remainder = totalExpense - sumShares;

  if (remainder > 0) {
    // Find highest totalFee participant
    let maxIdx = 0;
    for (let i = 1; i < rawShares.length; i++) {
      if (weights[i] > weights[maxIdx]) {
        maxIdx = i;
      }
    }
    rawShares[maxIdx].fairShare += remainder;
  }

  // 4. Calculate balance B_i = E_i - S_i
  const sharesWithBalance = rawShares.map((p) => ({
    warungId: p.warungId,
    warungName: p.warungName,
    adultCount: p.adultCount,
    childCount: p.childCount,
    totalExpensePaid: p.totalExpensePaid,
    fairShare: p.fairShare,
    balance: p.totalExpensePaid - p.fairShare,
  }));

  // 5. Greedy matching of creditors and debtors
  const creditors = sharesWithBalance
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = sharesWithBalance
    .filter((b) => b.balance < 0)
    .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance);

  const transfers: SplitResultTransfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const cred = creditors[ci];
    const deb = debtors[di];
    const amt = Math.min(cred.balance, deb.balance);

    if (amt > 0) {
      transfers.push({
        fromWarungId: deb.warungId,
        fromWarungName: deb.warungName,
        toWarungId: cred.warungId,
        toWarungName: cred.warungName,
        amount: Math.round(amt),
      });
    }

    cred.balance -= amt;
    deb.balance -= amt;

    if (cred.balance <= 0) ci++;
    if (deb.balance <= 0) di++;
  }

  return {
    totalExpense,
    totalFeeSum,
    shares: sharesWithBalance,
    transfers,
  };
}
