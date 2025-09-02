/**
 * Calculate Levenshtein distance between two strings
 * Lower distance = more similar strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0]![i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    track[j]![0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j]![i] = Math.min(
        track[j]![i - 1]! + 1, // deletion
        track[j - 1]![i]! + 1, // insertion
        track[j - 1]![i - 1]! + indicator, // substitution
      );
    }
  }
  
  return track[str2.length]![str1.length]!;
}

/**
 * Check if a string contains all characters of the query in order (but not necessarily consecutive)
 */
function containsInOrder(str: string, query: string): boolean {
  let queryIndex = 0;
  const strLower = str.toLowerCase();
  const queryLower = query.toLowerCase();
  
  for (let i = 0; i < strLower.length && queryIndex < queryLower.length; i++) {
    if (strLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length;
}

/**
 * Normalize string by removing spaces and special characters
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s\-\.\,\(\)\'\"]/g, '');
}

/**
 * Score how well a station name matches a search query
 * Higher score = better match
 */
export function fuzzyScore(stationName: string, query: string): number {
  const nameNormalized = normalize(stationName);
  const queryNormalized = normalize(query);
  
  // Exact match
  if (nameNormalized === queryNormalized) return 1000;
  
  // Starts with query
  if (nameNormalized.startsWith(queryNormalized)) return 900;
  
  // Contains exact query
  if (nameNormalized.includes(queryNormalized)) return 800;
  
  // Contains all characters in order (on normalized strings)
  if (containsInOrder(nameNormalized, queryNormalized)) return 700;
  
  // Calculate edit distance (lower is better)
  const distance = levenshteinDistance(nameNormalized, queryNormalized);
  const maxLength = Math.max(nameNormalized.length, queryNormalized.length);
  const similarity = 1 - (distance / maxLength);
  
  // If similarity is high enough, return a score
  if (similarity > 0.6) {
    return Math.floor(similarity * 600);
  }
  
  return 0;
}

/**
 * Filter and sort stations by fuzzy matching
 */
export function fuzzySearchStations<T extends { nameEn: string | null; name: string; id: string }>(
  stations: T[],
  query: string,
  limit = 20
): T[] {
  if (!query) return stations.slice(0, limit);
  
  const scored = stations
    .map(station => ({
      station,
      score: Math.max(
        station.nameEn ? fuzzyScore(station.nameEn, query) : 0,
        fuzzyScore(station.name, query)
      )
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return scored.slice(0, limit).map(item => item.station);
}