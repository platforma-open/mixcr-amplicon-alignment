// This utility is adapted from other blocks in the repository
// It can be moved to a shared SDK package in the future

// Extracts structured information from a MiXCR progress string.
// e.g. "[2/10, 20%, ETA 10m] Aligning" -> { stage: "Aligning", ... }
export function parseProgressString(progress: string) {
  if (!progress) {
    return {
      stage: 'Unknown',
      current: undefined,
      total: undefined,
      percentage: undefined,
      etaLabel: undefined,
    };
  }

  const stageMatch = progress.match(/\]\s*([\w\s]+)$/);
  const stage = stageMatch ? stageMatch[1].trim() : progress;

  const numbersMatch = progress.match(/\[([\d\.\s\w\/,]+)\]/);
  if (!numbersMatch) {
    return { stage, current: undefined, total: undefined, percentage: undefined, etaLabel: undefined };
  }
  const stats = numbersMatch[1];

  const ofMatch = stats.match(/(\d+)\/(\d+)/);
  const current = ofMatch ? parseInt(ofMatch[1], 10) : undefined;
  const total = ofMatch ? parseInt(ofMatch[2], 10) : undefined;

  const percentageMatch = stats.match(/(\d+(\.\d+)?)%/);
  const percentage = percentageMatch ? parseFloat(percentageMatch[1]) : undefined;

  const etaMatch = stats.match(/(ETA\s+[\w\d\s]+)/);
  const etaLabel = etaMatch ? etaMatch[1].trim() : undefined;

  return { stage, current, total, percentage, etaLabel };
} 