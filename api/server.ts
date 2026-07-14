/**
 * local server entry file, for local development
 */
import app from './_core/app.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").trim();
  const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
  console.log(`[Server] 茧房爆破器 Agent 运行在 http://localhost:${PORT}`);
  console.log(`[LLM] API Base: ${baseUrl}`);
  console.log(`[LLM] Model: ${model}`);
  console.log(`[LLM] API Key: ${apiKey ? `已配置 (前8位: ${apiKey.slice(0, 8)}..., 后6位: ...${apiKey.slice(-6)}, 长度: ${apiKey.length})` : "未配置"}`);
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
