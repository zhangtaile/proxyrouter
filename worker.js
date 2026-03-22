import { handleRequest } from './src/router.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
