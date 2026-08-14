const express = require('express');
const router = express.Router();
const { getDb } = require('../middleware/insforge');

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await getDb().from('volunteers').select('*').order('registered_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[Volunteers] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch volunteers' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, skill, location, coordinates, available } = req.body;
    if (!name || !phone || !skill) {
      return res.status(400).json({ error: 'Name, phone, and skill are required' });
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

    res.status(201).json({ id: data.id, message: 'Volunteer registered' });
  } catch (err) {
    console.error('[Volunteers] POST / error:', err);
    res.status(500).json({ error: 'Failed to register volunteer' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.id;
    delete updates.registeredAt;

    const mappedUpdates = {};
    for (const key of Object.keys(updates)) {
       const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
       mappedUpdates[snakeKey] = updates[key];
    }

    const { error } = await getDb().from('volunteers').update(mappedUpdates).eq('id', req.params.id);
    if (error) throw error;
    
    res.json({ message: 'Volunteer updated' });
  } catch (err) {
    console.error('[Volunteers] PATCH /:id error:', err);
    res.status(500).json({ error: 'Failed to update volunteer' });
  }
});

module.exports = router;
