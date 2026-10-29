import { createApp } from './app';
import { env } from './config/env';

const { app, emailService } = createApp();

app.listen(env.PORT, () => {
  console.info(
    JSON.stringify({
      level: 'info',
      message: `Trellis API server listening on port ${env.PORT}`,
      environment: env.NODE_ENV,
      useEmulator: env.USE_FIREBASE_EMULATOR,
      emailConfigured: emailService.isConfigured(),
      timestamp: new Date().toISOString(),
    })
  );
});
