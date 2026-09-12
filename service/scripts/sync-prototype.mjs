import {cp, rm} from 'node:fs/promises';

const source = new URL('../../wireframe/dist/', import.meta.url);
const destination = new URL('../public/prototype/', import.meta.url);
await rm(destination, {recursive: true, force: true});
await cp(source, destination, {recursive: true});
console.log('Copied the verified prototype to /prototype/.');
