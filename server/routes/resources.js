const express = require('express');
const router = express.Router();
const { getDb } = require('../middleware/insforge');

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await getDb().from('resources').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[Resources] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, contact, address, description } = req.body;
    if (!name || !type || !contact) {
      return res.status(400).json({ error: 'Name, type, and contact are required' });
    }

    const { data, error } = await getDb().from('resources').insert([{
      name,
      type,
      contact,
      address: address || '',
      description: description || ''
    }]).select('id').single();

    if (error) throw error;

    res.status(201).json({ id: data.id, message: 'Resource added' });
  } catch (err) {
    console.error('[Resources] POST / error:', err);
    res.status(500).json({ error: 'Failed to add resource' });
  }
});

module.exports = router;
