/**
 * local server entry file, for local development
 */
import app from './_core/app.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`[Server] 茧房爆破器 Agent 运行在 http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => { console.log('Server closed'); process.exit(0); });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => { console.log('Server closed'); process.exit(0); });
});

export default app;
