# Separate development infrastructure

`docker-compose.development.yml` defines the separate `version04_dev` project:
PostgreSQL, media PostgreSQL, and Redis only. It has no API, frontend, NATS,
seed, migration, restart policy, or route that can start product processes.

The numeric port contract is [`../config/ports.env`](../config/ports.env).
Use Compose with that file and a separately provisioned credential file:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/neighborly/development.env
```

The credential file is intentionally not created by repository tooling. After
approval, it must be a regular file, mode `0600`, owned by the invoking user;
its parent must be mode `0700`. Its values are generated locally and never
stored in Git, `config/ports.env`, logs, or chat.

Before development start, Doctor must report either `OFF` with the three
development ports free, or `READY` with the three named services healthy.
`BLOCKED` means the Engine, credential-file safety, port ownership, or service
health condition is not acceptable. With the approved development credential
file, `./run-project.sh start` starts only this project, applies the repository
migrations only to its dedicated PostgreSQL database, and starts launcher-owned
API and Vite processes on the registered host ports. It does not seed, reset,
pull, build, or touch base/staging projects.

The repository seed is optional demo data, not an infrastructure prerequisite:
new users can use the public registration flow without it. Doctor reports the
presence of its non-sensitive `SystemConfig/global` marker but does not expose
seed credentials or query user data. NATS is optional in the current startup
contract; its absence degrades event-driven notifications only. Doctor reads
the API readiness contract and blocks if that contract ever marks NATS required
while it is unavailable.

`./run-project.sh stop --service development` sends `TERM` only to the three
verified launcher-owned host processes and stops only the `version04_dev`
Compose services. It retains all three named development volumes.
