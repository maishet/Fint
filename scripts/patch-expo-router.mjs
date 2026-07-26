import { readFile, writeFile } from 'node:fs/promises'

const file = new URL('../node_modules/expo-router/build/fork/useLinking.native.js', import.meta.url)
let source

try {
  source = await readFile(file, 'utf8')
} catch {
  process.exit(0)
}

if (source.includes('function deferUnhandledLinking')) process.exit(0)

const initialStateStart = source.indexOf('const getInitialState =')
const initialStateEnd = source.indexOf('    React.useEffect(() => {', initialStateStart)
const initialStateSource = initialStateStart >= 0 && initialStateEnd > initialStateStart
  ? source.slice(initialStateStart, initialStateEnd)
  : ''
const directCall = 'onUnhandledLinking((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));'
const deferredCall = 'deferUnhandledLinking(onUnhandledLinking, (0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));'
const occurrences = initialStateSource.split(directCall).length - 1

if (occurrences !== 2) {
  throw new Error(`Unexpected expo-router initial linking source shape: found ${occurrences} callbacks`)
}

const patchedInitialState = initialStateSource.replaceAll(directCall, deferredCall)
const patched = `${source.slice(0, initialStateStart)}${patchedInitialState}${source.slice(initialStateEnd)}`.replace(
  '//# sourceMappingURL=useLinking.native.js.map',
  'function deferUnhandledLinking(callback, path) {\n    setTimeout(() => callback(path), 0);\n}\n//# sourceMappingURL=useLinking.native.js.map',
)

await writeFile(file, patched)
console.log('Patched expo-router initial linking callback')
