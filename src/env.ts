import { readFileSync } from 'fs';
import * as path from 'path';

export function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Strip inline comments like: KEY=val  # comment
      const hashIdx = value.indexOf('#');
      if (hashIdx > -1) value = value.slice(0, hashIdx).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore if .env not present
  }
}
