import { WordDefinition, SentenceAnalysis, QuizQuestion } from '../types';

const AI_BASE_PATH = '/api/ai';

async function postAi<T>(endpoint: string, payload: unknown): Promise<T> {
  const response = await fetch(`${AI_BASE_PATH}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `AI request failed with status ${response.status}`);
  }
  return body as T;
}

export { type WordDefinition, type SentenceAnalysis, type QuizQuestion };

export async function getWritingGuidance(word: string, meaning: string, previousSentences: string[]): Promise<string> {
  const payload = await postAi<{ guidance: string }>('writing-guidance', {
    word,
    meaning,
    previousSentences,
  });
  return payload.guidance;
}

export async function analyzeSentence(
  word: string,
  meaning: string,
  sentence: string,
  previousSentences: string[]
): Promise<SentenceAnalysis> {
  return postAi<SentenceAnalysis>('analyze-sentence', {
    word,
    meaning,
    sentence,
    previousSentences,
  });
}

export async function generatePracticeSentence(word: string, meaning: string): Promise<string> {
  const payload = await postAi<{ sentence: string }>('practice-sentence', {
    word,
    meaning,
  });
  return payload.sentence;
}

export async function generateWordDetails(word: string): Promise<WordDefinition> {
  return postAi<WordDefinition>('word-details', { word });
}

export async function suggestDailyWord(
  level: number,
  difficulty: string = 'intermediate',
  exclusionList: string[] = []
): Promise<string> {
  const payload = await postAi<{ word: string }>('suggest-daily-word', {
    level,
    difficulty,
    exclusionList,
  });
  return payload.word;
}

export async function verifyReview(
  word: string,
  userMeaning: string,
  sentences: string[]
): Promise<{ passed: boolean; feedback: string }> {
  return postAi<{ passed: boolean; feedback: string }>('verify-review', {
    word,
    userMeaning,
    sentences,
  });
}

export async function generateQuiz(words: string[]): Promise<QuizQuestion[]> {
  return postAi<QuizQuestion[]>('generate-quiz', { words });
}
