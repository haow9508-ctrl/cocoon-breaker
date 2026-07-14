/**
 * local server entry file, for local development
 */
import app from './_core/app.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`[Server] 茧房爆破器 Agent 运行在 http://localhost:${PORT}`);
  console.log(`[LLM] API Base: ${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1 (默认)"}`);
  console.log(`[LLM] Model: ${process.env.DEEPSEEK_MODEL || "deepseek-chat (默认)"}`);
  console.log(`[LLM] API Key: ${process.env.DEEPSEEK_API_KEY ? "已配置 (" + process.env.DEEPSEEK_API_KEY.slice(0, 8) + "...)" : "未配置"}`);
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
