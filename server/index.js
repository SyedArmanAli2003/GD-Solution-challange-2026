const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initInsForge } = require('./middleware/insforge');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve frontend static files (HTML, dist/*.js, CSS, images, public/)
app.use(express.static(path.resolve(__dirname, '..')));

initInsForge().then(() => {
  const incidentsRouter = require('./routes/incidents');
  const volunteersRouter = require('./routes/volunteers');
  const resourcesRouter = require('./routes/resources');
  const triageRouter = require('./routes/triage');
  const dispatchRouter = require('./routes/dispatch');

  app.use('/api/incidents', incidentsRouter);
  app.use('/api/volunteers', volunteersRouter);
  app.use('/api/resources', resourcesRouter);
  app.use('/api/triage', triageRouter);
  app.use('/api/dispatch', dispatchRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ResQNet Backend (InsForge)' });
  });

  app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`ResQNet backend running on port ${config.port} (0.0.0.0)`);
    console.log(`Frontend: http://localhost:${config.port}/auth.html`);
  });
}).catch(err => {
  console.error('[Server] Failed to initialize InsForge:', err);
  process.exit(1);
});
