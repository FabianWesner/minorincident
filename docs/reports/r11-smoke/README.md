# r11 smoke

The L8 smoke fixture now exercises the mission's real breach transition, seats the living evacuation group through APC passenger entry, and then boards the courier through normal interaction after the existing shader warm-up snapshot. It asserts that the whole fixture roster is seated, that `vehicle.entered` records the courier, and that no courier, held weapon, or vehicle shader builds occur after warm-up. The helper is part of the query-gated QA test API.

`npm run typecheck` passed. The first `npm run test:smoke` built the QA artifact, then failed before Playwright started: the browser-pool daemon could not bind its local IPC/socket (`listen EPERM`, `/var/folders/.../tsx-501/*.pipe` and `127.0.0.1:4329`). Full smoke and the public-artifact gate therefore still need a browser-pool run in an environment that permits its local listener; the required two green smoke runs have not yet been recorded.
