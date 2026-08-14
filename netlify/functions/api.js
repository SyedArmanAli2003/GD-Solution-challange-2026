const { createClient } = require('@supabase/supabase-js');

// ── Environment & Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ckjiukvxqqvjmpxhpclb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraml1a3Z4cXF2am1weGhwY2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjYxMTgsImV4cCI6MjA5ODEwMjExOH0.VWi7wlZdGKVF0q-9bF3bStOh6w-dW1eK9l-PqzBJmjI';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

let supabaseClient = null;
function getDb() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
  }
  return supabaseClient;
}

// ── AI Model Registry ────────────────────────────────────────────────────────
const AI_MODELS = [
  {
    id: 'nim-deepseek',
    label: 'DeepSeek V4 Flash (NIM)',
    provider: 'nvidia',
    model: 'deepseek-ai/deepseek-v4-flash',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKey: () => NVIDIA_API_KEY,
    temperature: 0.2,
    maxTokens: 1024,
    extra: { chat_template_kwargs: { thinking: false } },
    badge: 'DS·NIM',
    badgeColor: '#00d4ff',
  },
  {
    id: 'llama-3.3-70b',
    label: 'Llama 3.3 70b Instruct (OpenRouter)',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: () => OPENROUTER_API_KEY,
    temperature: 0.1,
    maxTokens: 512,
    badge: 'L3.3',
    badgeColor: '#a855f7',
  },
  {
    id: 'gpt-oss-120b',
    label: 'Mistral 7b Instruct (OpenRouter)',
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: () => OPENROUTER_API_KEY,
    temperature: 0.1,
    maxTokens: 512,
    badge: 'M7b',
    badgeColor: '#10b981',
  },
];

// ── Rules-based Triage Fallback ──────────────────────────────────────────────
function fallbackTriage(type, description = '', voice = '') {
  const text = `${description} ${voice}`.toLowerCase();
  const criticalHints = ['bleeding', 'unconscious', 'heart', 'stroke', 'trapped', 'collapse', 'fire', 'explosion', 'drowning', 'severe'];
  const urgentHints = ['injured', 'flood', 'riot', 'violence', 'shortage', 'urgent', 'broken', 'earthquake'];

  if (criticalHints.some(h => text.includes(h)))
    return { level: 1, levelName: 'Critical', color: 'red', reasoning: 'Fallback: high-risk emergency keywords detected.', volunteerTypes: ['medical', 'rapid-response'], estimatedMinutes: 8 };
  if (type === 'Medical' || type === 'Disaster' || urgentHints.some(h => text.includes(h)))
    return { level: 2, levelName: 'Severe', color: 'orange', reasoning: 'Fallback: urgent incident type or conditions.', volunteerTypes: ['rapid-response', 'medical'], estimatedMinutes: 15 };
  if (type === 'Conflict')
    return { level: 3, levelName: 'Moderate', color: 'yellow', reasoning: 'Fallback: conflict report requiring mediation/security.', volunteerTypes: ['coordination'], estimatedMinutes: 25 };
  if (type === 'Resource')
    return { level: 4, levelName: 'Minor', color: 'green', reasoning: 'Fallback: resource need and supply logistics.', volunteerTypes: ['logistics', 'supply'], estimatedMinutes: 35 };
  if (type === 'Hospitality')
    return { level: 5, levelName: 'Monitoring', color: 'gray', reasoning: 'Fallback: shelter and hospitality monitoring.', volunteerTypes: ['community-support'], estimatedMinutes: 45 };
  return { level: 3, levelName: 'Moderate', color: 'yellow', reasoning: 'Fallback: standard priority assessment.', volunteerTypes: ['support'], estimatedMinutes: 25 };
}

// ── AI Caller & Cascade ──────────────────────────────────────────────────────
async function callModel(modelCfg, messages) {
  const apiKey = modelCfg.apiKey();
  if (!apiKey) throw new Error(`No API key for ${modelCfg.label}`);

  const body = {
    model: modelCfg.model,
    messages,
    temperature: modelCfg.temperature,
    max_tokens: modelCfg.maxTokens,
  };

  if (modelCfg.provider === 'nvidia' && modelCfg.extra) {
    Object.assign(body, modelCfg.extra);
  }
  if (modelCfg.provider === 'openrouter') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${modelCfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://resqnet-gdsc-2026.netlify.app',
      'X-Title': 'ResQNet',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  if (data.error) throw new Error(`${data.error.code || res.status}: ${data.error.message}`);
  return data.choices?.[0]?.message?.content || null;
}

function extractJson(text, arrayMode = false) {
  if (!text) return null;
  const clean = text.replace(/```json|```/g, '').trim();
  if (arrayMode) {
    const s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s === -1 || e === -1) return null;
    return JSON.parse(clean.substring(s, e + 1));
  }
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) return null;
  return JSON.parse(clean.substring(s, e + 1));
}

async function callAI(messages, opts = {}) {
  const { preferredModel, parseJson = false, arrayMode = false } = opts;

  let ordered = [...AI_MODELS];
  if (preferredModel && preferredModel !== 'auto') {
    const idx = ordered.findIndex(m => m.id === preferredModel);
    if (idx > 0) {
      const [pref] = ordered.splice(idx, 1);
      ordered.unshift(pref);
    }
  }

  for (const model of ordered) {
    try {
      const text = await callModel(model, messages);
      if (!text) continue;

      let result = parseJson ? extractJson(text, arrayMode) : text;
      if (parseJson && !result) continue;

      if (parseJson && result && !Array.isArray(result)) result.modelUsed = model.label;
      return { result, modelUsed: model.label, badge: model.badge, badgeColor: model.badgeColor };
    } catch (err) {
      console.warn(`[AI] ${model.label} failed:`, err.message);
    }
  }
  return null;
}

function fallbackDispatch(pendingIncidents, availableVolunteers) {
  const matches = [];
  const vols = [...availableVolunteers];
  for (const inc of pendingIncidents) {
    const volIndex = vols.findIndex(v => v.available !== false);
    if (volIndex !== -1) {
      const vol = vols[volIndex];
      matches.push({ incidentId: inc.id, volunteerId: vol.id });
      vols.splice(volIndex, 1);
    }
  }
  return matches;
}

// ── HTTP Helper Responses ────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json',
};

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

function normalizePath(rawPath) {
  let p = rawPath || '/';
  p = p.replace(/^\/\.netlify\/functions\/api/, '');
  p = p.replace(/^\/api/, '');
  if (!p.startsWith('/')) p = '/' + p;
  return p.split('?')[0];
}

// ── Main Handler ─────────────────────────────────────────────────────────────
exports.handler = async (event, _context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  const method = event.httpMethod.toUpperCase();
  const path = normalizePath(event.path);
  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      body = {};
    }
  }

  try {
    // ── Health Check ──
    if (path === '/health' && method === 'GET') {
      return jsonResponse(200, {
        status: 'ok',
        service: 'ResQNet Backend (Supabase PostgreSQL & Netlify Functions)',
        timestamp: new Date().toISOString(),
      });
    }

    // ── Triage Models ──
    if (path === '/triage/models' && method === 'GET') {
      return jsonResponse(200, [
        { id: 'auto', label: 'Auto (Best Available)', badge: '⚡ Auto', badgeColor: '#f59e0b' },
        ...AI_MODELS.map(m => ({ id: m.id, label: m.label, badge: m.badge, badgeColor: m.badgeColor }))
      ]);
    }

    // ── Triage Assessment ──
    if (path === '/triage' && method === 'POST') {
      const { type, description, voiceTranscript, location, preferredModel } = body;
      if (!type) return jsonResponse(400, { error: 'Incident type is required' });

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

      return jsonResponse(200, triage);
    }

    // ── Dispatch Matching ──
    if (path === '/dispatch' && method === 'POST') {
      const { prompt, pendingIncidents, availableVolunteers, preferredModel } = body;
      if (!pendingIncidents || pendingIncidents.length === 0)
        return jsonResponse(400, { error: 'No pending incidents provided' });
      if (!availableVolunteers || availableVolunteers.length === 0)
        return jsonResponse(400, { error: 'No available volunteers provided' });

      const ai = await callAI(
        [{ role: 'user', content: prompt || 'Match volunteers to incidents based on skills and proximity.' }],
        { preferredModel: preferredModel || 'nim-deepseek', parseJson: true, arrayMode: true }
      );

      const matches = Array.isArray(ai?.result) && ai.result.length > 0
        ? ai.result
        : fallbackDispatch(pendingIncidents, availableVolunteers);

      return jsonResponse(200, { matches, modelUsed: ai?.modelUsed || 'Fallback rules' });
    }

    // ── Incidents Routes ──
    if (path === '/incidents' && method === 'GET') {
      const { data, error } = await getDb().from('incidents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (path.match(/^\/incidents\/([^/]+)\/timeline$/) && method === 'GET') {
      const incidentId = path.match(/^\/incidents\/([^/]+)\/timeline$/)[1];
      const { data, error } = await getDb().from('incident_timeline').select('*').eq('incident_id', incidentId).order('created_at', { ascending: true });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (path.match(/^\/incidents\/([^/]+)$/) && method === 'GET') {
      const incidentId = path.match(/^\/incidents\/([^/]+)$/)[1];
      const { data, error } = await getDb().from('incidents').select('*').eq('id', incidentId).single();
      if (error) throw error;
      if (!data) return jsonResponse(404, { error: 'Incident not found' });
      return jsonResponse(200, data);
    }

    if (path === '/incidents' && method === 'POST') {
      const { type, description, location, coordinates, voiceTranscript, reporterName, reporterPhone } = body;
      if (!type) return jsonResponse(400, { error: 'Incident type is required' });

      const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
      let reporterId = null;
      if (authHeader.startsWith('Bearer ')) {
        reporterId = authHeader.replace('Bearer ', '').slice(0, 36);
      }

      const { data: incident, error } = await getDb().from('incidents').insert([{
        type,
        description: description || '',
        location: location || 'Unknown location',
        coordinates: coordinates || null,
        voice_transcript: voiceTranscript || '',
        status: 'pending',
        triage_complete: false,
        reporter_id: reporterId,
        reporter_name: reporterName || 'Anonymous',
        reporter_phone: reporterPhone || null
      }]).select('id').single();

      if (error) throw error;

      try {
        await getDb().from('incident_timeline').insert([{
          incident_id: incident.id,
          action: 'created',
          actor: reporterName || 'reporter',
          details: `${type} incident reported${location !== 'Unknown location' ? ' at ' + location.substring(0, 50) : ''}`,
        }]);
      } catch (tlErr) {
        console.warn('[Timeline] Note:', tlErr.message);
      }

      return jsonResponse(201, { id: incident.id, message: 'Incident created' });
    }

    if (path.match(/^\/incidents\/([^/]+)$/) && method === 'PATCH') {
      const incidentId = path.match(/^\/incidents\/([^/]+)$/)[1];
      const updates = { ...body };
      delete updates.id;
      delete updates.timestamp;

      const mappedUpdates = {};
      for (const key of Object.keys(updates)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        mappedUpdates[snakeKey] = updates[key];
      }

      if (mappedUpdates.status === 'resolved') {
        mappedUpdates.resolved_at = new Date().toISOString();
        try {
          const { data: inc } = await getDb().from('incidents').select('assigned_volunteer_id').eq('id', incidentId).single();
          if (inc?.assigned_volunteer_id) {
            await getDb().from('volunteers').update({ available: true, active_incident_id: null }).eq('id', inc.assigned_volunteer_id);
          }
        } catch { }
      }

      const { error } = await getDb().from('incidents').update(mappedUpdates).eq('id', incidentId);
      if (error) throw error;
      return jsonResponse(200, { message: 'Incident updated' });
    }

    // ── Volunteers Routes ──
    if (path === '/volunteers' && method === 'GET') {
      const { data, error } = await getDb().from('volunteers').select('*').order('registered_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (path === '/volunteers' && method === 'POST') {
      const { name, phone, skill, location, coordinates, available } = body;
      if (!name || !phone || !skill) {
        return jsonResponse(400, { error: 'Name, phone, and skill are required' });
      }

      const { data, error } = await getDb().from('volunteers').insert([{
        name,
        phone,
        skill,
        location: location || 'Location not provided',
        coordinates: coordinates || null,
        available: available !== false,
      }]).select('id').single();

      if (error) throw error;
      return jsonResponse(201, { id: data.id, message: 'Volunteer registered' });
    }

    if (path.match(/^\/volunteers\/([^/]+)$/) && method === 'PATCH') {
      const volunteerId = path.match(/^\/volunteers\/([^/]+)$/)[1];
      const updates = { ...body };
      delete updates.id;
      delete updates.registeredAt;

      const mappedUpdates = {};
      for (const key of Object.keys(updates)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        mappedUpdates[snakeKey] = updates[key];
      }

      const { error } = await getDb().from('volunteers').update(mappedUpdates).eq('id', volunteerId);
      if (error) throw error;
      return jsonResponse(200, { message: 'Volunteer updated' });
    }

    // ── Resources Routes ──
    if (path === '/resources' && method === 'GET') {
      const { data, error } = await getDb().from('resources').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (path === '/resources' && method === 'POST') {
      const { name, type, contact, address, description } = body;
      if (!name || !type || !contact) {
        return jsonResponse(400, { error: 'Name, type, and contact are required' });
      }

      const { data, error } = await getDb().from('resources').insert([{
        name,
        type,
        contact,
        address: address || '',
        description: description || ''
      }]).select('id').single();

      if (error) throw error;
      return jsonResponse(201, { id: data.id, message: 'Resource added' });
    }

    return jsonResponse(404, { error: `Endpoint ${method} ${path} not found` });
  } catch (err) {
    console.error(`[API Error] ${method} ${path}:`, err);
    return jsonResponse(500, { error: err.message || 'Internal server error' });
  }
};
