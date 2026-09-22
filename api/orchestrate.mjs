export { GEMINI_API_VERSION, geminiEndpoint, geminiSchema, handleOrchestration } from '../app/orchestrate-core.mjs';

import { handleOrchestration } from '../app/orchestrate-core.mjs';

export default async function handler(request) {
  return handleOrchestration(request);
}
