import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20260912000100_build26_foundation.sql', import.meta.url);

test('public catalog access is limited to the version selected by its resource', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(
    migration,
    /resource versions: public current published catalog[\s\S]*resources r[\s\S]*r\.published_version_id = id/
  );
});
