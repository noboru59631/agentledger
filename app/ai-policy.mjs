export const SERVICE_CATEGORIES = ['research', 'translation', 'data', 'api'];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function validateProposal(proposal, taskBudget, { now = Date.now() } = {}) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') return { valid: false, errors: ['Proposal must be an object.'] };
  if (typeof proposal.taskSummary !== 'string' || proposal.taskSummary.trim().length < 3) errors.push('Task summary is missing.');
  if (!proposal.rootAgent || typeof proposal.rootAgent.role !== 'string') errors.push('Root agent role is missing.');
  if (typeof proposal.needsSubAgents !== 'boolean') errors.push('needsSubAgents must be boolean.');
  if (!Array.isArray(proposal.subAgents) || proposal.subAgents.length > 3) errors.push('There must be between zero and three sub-agents.');
  if (proposal.needsSubAgents && proposal.subAgents.length === 0) errors.push('The proposal says sub-agents are needed but provides none.');
  if (!isFiniteNumber(taskBudget) || taskBudget <= 0) errors.push('Task budget must be positive.');
  if (!isFiniteNumber(proposal.rootAgent.budget) || proposal.rootAgent.budget > taskBudget) errors.push('Root allocation exceeds the task budget.');
  const allocations = (proposal.subAgents || []).reduce((sum, agent) => sum + (isFiniteNumber(agent.budget) ? agent.budget : Number.POSITIVE_INFINITY), 0);
  if (allocations > taskBudget) errors.push('Child allocations exceed the task budget.');
  const services = proposal.services || [];
  if (!Array.isArray(services)) errors.push('Services must be an array.');
  for (const service of services) {
    if (!SERVICE_CATEGORIES.includes(service.category)) errors.push(`Service category is not allowed: ${service.category || 'missing'}.`);
    if (!isFiniteNumber(service.estimatedCost) || service.estimatedCost < 0) errors.push('Every service needs a non-negative estimated cost.');
  }
  const estimated = services.reduce((sum, service) => sum + (isFiniteNumber(service.estimatedCost) ? service.estimatedCost : Number.POSITIVE_INFINITY), 0);
  if (estimated > taskBudget) errors.push('Estimated service costs exceed the task budget.');
  const allowedScope = new Set(SERVICE_CATEGORIES);
  const rootBudget = isFiniteNumber(proposal.rootAgent?.budget) ? proposal.rootAgent.budget : 0;
  const requestIds = new Set();
  for (const agent of proposal.subAgents || []) {
    if (!isFiniteNumber(agent.budget) || agent.budget < 0 || agent.budget > rootBudget) errors.push(`Child allocation for ${agent.role || 'unnamed agent'} exceeds its parent. `);
    if (!Array.isArray(agent.scope) || agent.scope.some((category) => !allowedScope.has(category))) errors.push(`Scope for ${agent.role || 'unnamed agent'} widens beyond the task services.`);
    if (!Number.isInteger(agent.delegationDepth) || agent.delegationDepth < 0 || agent.delegationDepth >= 2) errors.push(`Delegation depth for ${agent.role || 'unnamed agent'} is not monotonically narrower.`);
    if (agent.expiry && proposal.expiry && new Date(agent.expiry).getTime() > new Date(proposal.expiry).getTime()) errors.push(`Expiry for ${agent.role || 'unnamed agent'} extends the parent.`);
  }
  for (const service of services) {
    if (service.requestId && requestIds.has(service.requestId)) errors.push(`Duplicate service request replay: ${service.requestId}.`);
    if (service.requestId) requestIds.add(service.requestId);
    if (service.sender && service.recipient && service.sender.toLowerCase() === service.recipient.toLowerCase()) errors.push('Service recipient must be distinct from the sender.');
  }
  if (proposal.expiry && new Date(proposal.expiry).getTime() < now) errors.push('Proposal expiry is already in the past.');
  return { valid: errors.length === 0, errors };
}

export function evaluateDemoPlan(proposal, taskBudget, { revoked = false } = {}) {
  const validation = validateProposal(proposal, taskBudget);
  const decisions = [];
  const blockedActions = [...validation.errors];
  if (revoked) blockedActions.push('STOP propagated: root task is revoked, so queued descendants cannot execute.');
  const reserved = validation.valid ? (proposal.subAgents || []).reduce((sum, agent) => sum + agent.budget, 0) : 0;
  const spent = validation.valid ? Math.min(0.2, taskBudget - reserved) : 0;
  for (const service of proposal.services || []) {
    const allowed = SERVICE_CATEGORIES.includes(service.category) && validation.valid && !revoked;
    decisions.push({ ...service, status: allowed ? 'allowed (simulated)' : 'blocked', reason: allowed ? 'Allowlisted and within reserved budget.' : (revoked ? 'Root task revoked.' : 'Rejected by deterministic policy.') });
  }
  return { valid: validation.valid && !revoked, errors: validation.errors, decisions, allocated: reserved, reserved, spent, remaining: Math.max(0, taskBudget - reserved - spent), blockedActions };
}

export function fallbackPlan(goal, budget) {
  return {
    taskSummary: goal || 'Research competing projects on Arc and produce a comparison report.',
    rootAgent: { role: 'Research coordinator', budget },
    needsSubAgents: true,
    subAgents: [
      { role: 'Market research agent', budget: Math.min(2.5, budget * 0.5), scope: ['research', 'data'], expiry: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), delegationDepth: 1 },
      { role: 'Report editor', budget: Math.min(1, budget * 0.2), scope: ['translation'], expiry: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), delegationDepth: 1 },
    ],
    services: [
      { category: 'research', description: 'Search public Arc project materials', estimatedCost: Math.min(0.2, budget) },
      { category: 'translation', description: 'Translate selected excerpts', estimatedCost: Math.min(0.2, budget * 0.1) },
    ],
    finalOutputType: 'comparison report',
    expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
