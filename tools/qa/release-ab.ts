/** Release drivers all use launchBrowser from the shared headless pool.
 * This TypeScript entrypoint is recognized by the existing pool reservation router.
 * node --import tsx tools/qa/release-ab.ts <load|scenes|strips|effects|engage|handover|mouse> [levels/backend]
 */
const command = process.argv[2];
if (!['load', 'scenes', 'strips', 'effects', 'engage', 'handover', 'mouse'].includes(command)) throw new Error('Expected load, scenes, strips, effects, engage, handover or mouse');
const driver = command === 'scenes' || command === 'strips' ? 'browser' : command;
if (driver !== 'browser') process.argv.splice(2, 1);
await import(new URL(`./release-ab-${driver}.mjs`, import.meta.url).href);
export {};
