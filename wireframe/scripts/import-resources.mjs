import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateKnowledge} from './knowledge.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const knowledgePath = resolve(root, 'data/knowledge.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const sourceArg = args.find(argument => !argument.startsWith('--'));

if (!sourceArg) {
  console.error('Usage: npm run resources:import -- <resources.json> [--write]');
  process.exitCode = 1;
} else {
  const sourcePath = resolve(process.cwd(), sourceArg);
  const input = JSON.parse(await readFile(sourcePath, 'utf8'));
  const incoming = Array.isArray(input) ? input : input?.resources;
  if (!Array.isArray(incoming) || incoming.length === 0) throw new Error('Import file must be a non-empty array or {"resources": [...]}');
  if (incoming.some(resource => resource?.reviewStatus !== 'draft')) throw new Error('Imported resources must use reviewStatus "draft"');

  const current = JSON.parse(await readFile(knowledgePath, 'utf8'));
  const existingIds = new Set(current.resources.map(resource => resource.id));
  const incomingIds = incoming.map(resource => resource?.id);
  if (new Set(incomingIds).size !== incomingIds.length) throw new Error('Import file contains duplicate resource IDs');
  const conflicts = incomingIds.filter(id => existingIds.has(id));
  if (conflicts.length) throw new Error(`Resource IDs already exist: ${conflicts.join(', ')}`);

  const merged = validateKnowledge({...current, resources: [...current.resources, ...incoming]});
  if (write) {
    await writeFile(knowledgePath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`Imported ${incoming.length} draft resources into data/knowledge.json`);
  } else {
    console.log(`Validated ${incoming.length} draft resources. Run again with --write to import them.`);
  }
}
