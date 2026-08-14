const express = require('express');
const router = express.Router();
const { getDb } = require('../middleware/insforge');
const { verifyToken } = require('../middleware/auth');

const { rateLimitPost } = require('../middleware/rateLimit');

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await getDb().database.from('incidents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[Incidents] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await getDb().database.from('incidents').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Incident not found' });
    res.json(data);
  } catch (err) {
    console.error('[Incidents] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

router.post('/', rateLimitPost, verifyToken, async (req, res) => {
  try {
    const { type, description, location, coordinates, voiceTranscript, reporterName, reporterPhone } = req.body;
    if (!type) return res.status(400).json({ error: 'Incident type is required' });

    const { data: incident, error } = await getDb().database.from('incidents').insert([{
      type,
      description: description || '',
      location: location || 'Unknown location',
      coordinates: coordinates || null,
      voice_transcript: voiceTranscript || '',
      status: 'pending',
      triage_complete: false,
      reporter_id: req.user?.uid || req.user?.id || null,
      reporter_name: reporterName || req.user?.name || 'Anonymous',
    }]).select('id').single();

    if (error) throw error;

    await getDb().database.from('incident_timeline').insert([{
      incident_id: incident.id,
      action: 'created',
      actor: reporterName || req.user?.email || 'reporter',
      details: `${type} incident reported${location !== 'Unknown location' ? ' at ' + location.substring(0, 50) : ''}`,
    }]);

    res.status(201).json({ id: incident.id, message: 'Incident created' });
  } catch (err) {
    console.error('[Incidents] POST / error:', err);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.id;
    delete updates.timestamp;

    const mappedUpdates = {};
    for (const key of Object.keys(updates)) {
       const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
       mappedUpdates[snakeKey] = updates[key];
    }

    if (mappedUpdates.status === 'resolved') {
      mappedUpdates.resolved_at = new Date().toISOString();

      const { data: incident } = await getDb().database.from('incidents').select('assigned_volunteer_id').eq('id', req.params.id).single();

      if (incident?.assigned_volunteer_id) {
        await getDb().database.from('volunteers').update({
          available: true,
          active_incident_id: null
        }).eq('id', incident.assigned_volunteer_id);
      }
    }

    const { error } = await getDb().database.from('incidents').update(mappedUpdates).eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Incident updated' });
  } catch (err) {
    console.error('[Incidents] PATCH /:id error:', err);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const { data, error } = await getDb().database.from('incident_timeline').select('*').eq('incident_id', req.params.id).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[Incidents] GET /:id/timeline error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

module.exports = router;
