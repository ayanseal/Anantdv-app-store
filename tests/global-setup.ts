import { migrateTestDatabase } from './migrate-test-db';
export default function setup() {
  migrateTestDatabase('data/test.db');
}
