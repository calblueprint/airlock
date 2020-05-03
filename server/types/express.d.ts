import { Record } from 'airtable';

declare global {
  namespace Express {
    export interface Request {
      user?: Record<any>;
      context?: Record<any> | { records: Record<any>[] };
    }
  }
}
