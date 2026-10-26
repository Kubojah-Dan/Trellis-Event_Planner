import { createApp } from './app';
import { env } from './config/env';

const { app } = createApp();

app.listen(env.PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `Trellis API server listening on port ${env.PORT}`,
      environment: env.NODE_ENV,
      useEmulator: env.USE_FIREBASE_EMULATOR,
      timestamp: new Date().toISOString(),
    })
  );
});
