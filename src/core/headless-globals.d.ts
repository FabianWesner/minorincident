// structuredClone is a host primitive shared by Node 22 and browsers, not a DOM API.
// Keep DOM lib declarations out of the headless compilation.
declare function structuredClone<T>(value: T): T;
