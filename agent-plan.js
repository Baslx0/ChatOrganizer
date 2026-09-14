(() => {
  const input = document.getElementById('plan-input');
  if (!input) return;

  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const plan = JSON.parse(await file.text());
      if (!Array.isArray(plan.actions)) throw new Error('Invalid plan: actions must be an array.');

      const allowed = new Set(['move', 'keep', 'archive', 'review']);
      const known = new Map(state.conversations.map(c => [String(c.id), c]));
      const projectNames = new Set([
        ...(Array.isArray(plan.projects) ? plan.projects.map(p => p?.name).filter(Boolean) : []),
        ...plan.actions.map(a => a?.project).filter(Boolean),
      ]);

      for (const project of projectNames) {
        if (project === 'Unclassified') continue;
        if (!state.rules.some(rule => rule.name === project)) state.rules.push({ name: project, keywords: [] });
      }
      saveRules();

      state.analyzed = plan.actions.map((action, index) => {
        if (!action?.id) throw new Error(`Invalid plan: actions[${index}].id is required.`);
        if (!allowed.has(action.action)) throw new Error(`Invalid plan action: ${action.action}`);
        const base = known.get(String(action.id)) || {
          id: String(action.id),
          title: action.title || 'Untitled conversation',
          createTime: null,
          updateTime: null,
          text: '',
        };
        return {
          ...base,
          title: action.title || base.title,
          project: action.project || 'Unclassified',
          confidence: Number.isFinite(Number(action.confidence)) ? Number(action.confidence) : 0.5,
          action: action.action,
          reason: action.reason || (Array.isArray(action.evidence) && action.evidence.length ? action.evidence.join(' · ') : 'Agent-generated proposal.'),
          duplicate: false,
          ageDays: 0,
          matched: [],
          evidence: Array.isArray(action.evidence) ? action.evidence : [],
          alternatives: Array.isArray(action.alternatives) ? action.alternatives : [],
        };
      });

      state.selected.clear();
      renderAll();
      setView('review');
      toast(`Imported agent plan with ${state.analyzed.length} actions`);
    } catch (error) {
      toast(error.message || 'Could not import agent plan');
    } finally {
      event.target.value = '';
    }
  });
})();
