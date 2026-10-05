# Shared validation image

Each agent keeps its own Git worktree and container. This image provides Linux
dependencies and a filtered source snapshot for warning-repair validation. It
does not mount another agent's checkout, expose ports, or receive credentials.
The Dockerfile-specific ignore file excludes environment files and local state.
Public media is excluded; the existing generated asset metadata remains in src.

From the intended worktree:

```powershell
docker build -f docker/agent-work/Dockerfile -t jjx-agent-warnings:local .
docker run --rm --name jjx-agent-warnings-tests --network none --cap-drop ALL --security-opt no-new-privileges jjx-agent-warnings:local
```

Agents may use the built image as a dependency base in separately named containers.
Dependencies are under `/work/node_modules`; Node is 24 and pnpm is 11.22.0.
Never mount the Docker socket or a production environment file for these tests.
Coordinate ports before starting a separate preview. Keep changes in the owning
agent's worktree and integrate reviewed commits through Git.

The offline test suite covers warning classification, provider contracts,
authorization boundaries, the agent network, and disposable PGlite payment tests.
It cannot verify live provider credentials or provider delivery.
