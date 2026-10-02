const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "with",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
]);

export function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word));
}

function editDistance(a, b) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from(
    { length: second.length + 1 },
    (_, index) => index,
  );

  for (let i = 1; i <= first.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= second.length; j += 1) {
      const insert = current[j - 1] + 1;
      const remove = previous[j] + 1;

      const replace =
        previous[j - 1] +
        (first[i - 1] === second[j - 1] ? 0 : 1);

      current.push(
        Math.min(insert, remove, replace),
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[second.length];
}

function wordScore(queryWord, candidateWord) {
  if (!queryWord || !candidateWord) {
    return 0;
  }

  if (queryWord === candidateWord) {
    return 100;
  }

  if (
    candidateWord.includes(queryWord) ||
    queryWord.includes(candidateWord)
  ) {
    return 80;
  }

  const distance = editDistance(
    queryWord,
    candidateWord,
  );

  const maxLength = Math.max(
    queryWord.length,
    candidateWord.length,
  );

  // Small typo: monitor -> moniter
  if (maxLength >= 5 && distance <= 1) {
    return 65;
  }

  // Slightly larger typo
  if (maxLength >= 7 && distance <= 2) {
    return 45;
  }

  return 0;
}

export function getSearchScore(query, fields = []) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 1;
  }

  const searchableFields = fields
    .filter(Boolean)
    .map(normalizeText)
    .filter(Boolean);

  if (!searchableFields.length) {
    return 0;
  }

  const searchableText = searchableFields.join(" ");

  let score = 0;

  // Exact phrase match
  if (searchableText.includes(normalizedQuery)) {
    score += 100;
  }

  const queryWords = tokenize(normalizedQuery);
  const candidateWords = tokenize(searchableText);

  let matchedWords = 0;

  for (const queryWord of queryWords) {
    let bestScore = 0;

    for (const candidateWord of candidateWords) {
      bestScore = Math.max(
        bestScore,
        wordScore(queryWord, candidateWord),
      );
    }

    if (bestScore > 0) {
      matchedWords += 1;
      score += bestScore;
    }
  }

  if (queryWords.length) {
    const matchRatio =
      matchedWords / queryWords.length;

    score += matchRatio * 50;
  }

  return score;
}

export function smartSearch(
  items,
  query,
  getFields,
  minimumScore = 25,
) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return items;
  }

  return items
    .map((item) => ({
      item,
      score: getSearchScore(
        normalizedQuery,
        getFields(item),
      ),
    }))
    .filter(({ score }) => score >= minimumScore)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}