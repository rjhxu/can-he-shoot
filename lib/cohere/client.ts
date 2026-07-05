import { CohereClient } from 'cohere-ai';
import {
  SQL_GENERATION_SYSTEM_PROMPT,
  SQL_RESPONSE_SCHEMA,
  SUMMARY_SYSTEM_PROMPT,
} from './prompts';

const MODEL = 'command-a-03-2025';

let client: CohereClient | null = null;

function getClient(): CohereClient {
  if (!client) {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error('Missing required environment variable: COHERE_API_KEY');
    }
    client = new CohereClient({ token: apiKey });
  }
  return client;
}

export interface SqlGenerationResult {
  sql: string;
  referenced_player_ids: number[];
}

export async function generateSql(question: string): Promise<SqlGenerationResult> {
  const response = await getClient().chat({
    model: MODEL,
    message: question,
    preamble: SQL_GENERATION_SYSTEM_PROMPT,
    responseFormat: {
      type: 'json_object',
      schema: SQL_RESPONSE_SCHEMA,
    },
    temperature: 0.1,
  });

  const parsed = JSON.parse(response.text) as {
    sql?: string;
    referenced_player_ids?: number[];
  };

  if (!parsed.sql || typeof parsed.sql !== 'string') {
    throw new Error('Cohere did not return a valid SQL query');
  }

  return {
    sql: parsed.sql,
    referenced_player_ids: Array.isArray(parsed.referenced_player_ids)
      ? parsed.referenced_player_ids.filter((id) => Number.isInteger(id))
      : [],
  };
}

export async function summarizeResults(
  question: string,
  rows: Record<string, unknown>[],
): Promise<string> {
  const response = await getClient().chat({
    model: MODEL,
    message: `Question: ${question}\nResults: ${JSON.stringify(rows.slice(0, 50))}`,
    preamble: SUMMARY_SYSTEM_PROMPT,
    maxTokens: 120,
    temperature: 0.3,
  });

  return response.text.trim() || 'No matching data was found. Try rephrasing your question.';
}
