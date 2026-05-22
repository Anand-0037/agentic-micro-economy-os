import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const authToken = env.SENTRY_AUTH_TOKEN;

  const plugins = [react()];

  if (authToken && env.SENTRY_ORG && env.SENTRY_PROJECT) {
    plugins.push(
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken,
        silent: !process.env.CI,
      }),
    );
  }

  return {
    plugins,
    build: {
      sourcemap: true,
    },
  };
});
