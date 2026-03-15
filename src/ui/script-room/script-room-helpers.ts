export function scriptTierLabel(value: string | undefined): string | null {
  if (value === 'bargain') return 'Bargain';
  if (value === 'biddingWar') return 'Bidding War';
  return null;
}
