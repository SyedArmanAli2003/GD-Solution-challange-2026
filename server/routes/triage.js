const express = require('express');
const router = express.Router();
const { callAI, AI_MODELS } = require('./aiCascade');
const { rateLimitPost } = require('../middleware/rateLimit');

// ── Rules-based fallback ───────────────────────────────────────────────────────
function fallbackTriage(type, description = '', voice = '') {
  const text = `${description} ${voice}`.toLowerCase();
  const criticalHints = ['bleeding', 'unconscious', 'heart', 'stroke', 'trapped', 'collapse', 'fire', 'explosion'];
  const urgentHints = ['injured', 'flood', 'riot', 'violence', 'shortage', 'urgent'];

  if (criticalHints.some(h => text.includes(h)))
    return { level: 1, levelName: 'Critical', color: 'red', reasoning: 'Fallback: high-risk keywords detected.', volunteerTypes: ['medical', 'rapid-response'], estimatedMinutes: 8 };
  if (type === 'Medical' || type === 'Disaster' || urgentHints.some(h => text.includes(h)))
    return { level: 2, levelName: 'Severe', color: 'orange', reasoning: 'Fallback: urgent incident type.', volunteerTypes: ['rapid-response'], estimatedMinutes: 15 };
  if (type === 'Conflict')
    return { level: 3, levelName: 'Moderate', color: 'yellow', reasoning: 'Fallback: conflict report.', volunteerTypes: ['coordination'], estimatedMinutes: 25 };
  if (type === 'Resource')
    return { level: 4, levelName: 'Minor', color: 'green', reasoning: 'Fallback: resource need.', volunteerTypes: ['logistics'], estimatedMinutes: 35 };
  if (type === 'Hospitality')
    return { level: 5, levelName: 'Monitoring', color: 'gray', reasoning: 'Fallback: monitoring / support.', volunteerTypes: ['community-support'], estimatedMinutes: 45 };
  return { level: 3, levelName: 'Moderate', color: 'yellow', reasoning: 'Fallback: moderate priority.', volunteerTypes: ['support'], estimatedMinutes: 25 };
}

// ── GET /api/triage/models — model registry for frontend selector ──────────────
router.get('/models', (_req, res) => {
  res.json([
    { id: 'auto', label: 'Auto (Best Available)', badge: '⚡ Auto', badgeColor: '#f59e0b' },
    ...AI_MODELS.map(m => ({ id: m.id, label: m.label, badge: m.badge, badgeColor: m.badgeColor }))
  ]);
});

// ── POST /api/triage ──────────────────────────────────────────────────────────
router.post('/', rateLimitPost, async (req, res) => {
  try {
    const { type, description, voiceTranscript, location, preferredModel } = req.body;
    if (!type) return res.status(400).json({ error: 'Incident type is required' });

    const prompt = `You are an emergency triage AI. Analyze this crisis and return ONLY valid JSON.
No explanation, no markdown, no backticks.

Type: ${type}
Description: ${description || 'none'}
Voice transcript: ${voiceTranscript || 'none'}
Location: ${location || 'Unknown'}

Return exactly this shape:
{"level": 1, "levelName": "Critical", "color": "red", "reasoning": "one sentence max", "volunteerTypes": ["type1"], "estimatedMinutes": 10}

Level guide: 1=Critical(red), 2=Severe(orange), 3=Moderate(yellow), 4=Minor(green), 5=Monitoring(gray)`;

    const ai = await callAI(
      [{ role: 'user', content: prompt }],
      { preferredModel: preferredModel || 'nim-deepseek', parseJson: true }
    );

    const triage = ai?.result || { ...fallbackTriage(type, description, voiceTranscript), modelUsed: 'Fallback rules' };
    if (!triage.modelUsed) triage.modelUsed = ai?.modelUsed || 'Fallback rules';
    if (!triage.badge) { triage.badge = ai?.badge || '⚙️'; triage.badgeColor = ai?.badgeColor || '#6b7280'; }

    console.log(`[Triage] Level ${triage.level} (${triage.levelName}) via ${triage.modelUsed}`);
    res.json(triage);
  } catch (err) {
    console.error('[Triage] POST / error:', err);
    res.status(500).json({ error: 'Triage failed' });
  }
});

module.exports = router;
