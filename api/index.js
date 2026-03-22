import { handleRequest } from '../src/router.js';

export const config = {
  runtime: 'edge',
};

export default async function (request) {
  // Vercel Edge 环境下环境变量直接通过 process.env 访问
  // router.js 内部已经处理了对 process.env 的兼容
  return handleRequest(request);
}
