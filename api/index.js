// Vercel serverless function entry point
import app from '../server/api.js';

export default async (req, res) => {
  // Vercel provides req and res objects that are compatible with Express
  return app(req, res);
};