/** Compose native-pixel readability, source and mixed-crowd A/B sheets. */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
execFileSync(process.env.PYTHON ?? resolve(homedir(), '.venvs/3dpipeline/bin/python'), ['tools/scenelab/tex-infected-sheets.py'], { stdio: 'inherit' });
