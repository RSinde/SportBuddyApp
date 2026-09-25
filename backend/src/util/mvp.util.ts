export function tallyMvpWinners(votes: Record<string, string>): string[] {
  const tally: Record<string, number> = {};
  for (const votedFor of Object.values(votes)) {
    tally[votedFor] = (tally[votedFor] ?? 0) + 1;
  }

  const counts = Object.values(tally);
  if (counts.length === 0) return [];

  const maxVotes = Math.max(...counts);
  return Object.keys(tally).filter((id) => tally[id] === maxVotes);
}
