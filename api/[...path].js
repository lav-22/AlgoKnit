import app from '../server/server.js';
import { connectDatabase } from '../server/services/database.js';

export default async function handler(req, res) {
  await connectDatabase();
  return app(req, res);
}
