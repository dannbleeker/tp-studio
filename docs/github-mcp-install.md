# Installing the GitHub MCP server for Claude Code

Session 84 documented this as a follow-up to the `gh` CLI install. The GitHub MCP server gives Claude typed access to GitHub (runs, PRs, issues, content, security alerts) without shelling out — cleaner than parsing `gh` CLI output by hand.

## Prerequisites

- **Docker Desktop** (or any local Docker daemon). The MCP server is distributed as a container image at `ghcr.io/github/github-mcp-server`.
- A **GitHub Personal Access Token** with at least the `repo`, `read:packages`, `read:org` scopes. Create at <https://github.com/settings/tokens>.
- **Claude Code** installed (you're already running it).

## Install

1. **Pull the image once** (Docker handles updates on subsequent runs):
   ```
   docker pull ghcr.io/github/github-mcp-server
   ```

2. **Store the token** somewhere Claude Code can pick it up. Two options:
   - **Recommended**: set `GITHUB_PERSONAL_ACCESS_TOKEN` as a Windows user env var (Control Panel → Edit environment variables for your account). New shells inherit it.
   - **Alternatively**: put it inline in the MCP config below (less safe — token sits in plain text in a file).

3. **Add the server to Claude Code settings.** Edit `~/.claude/settings.json` (user-level — applies across all projects). Merge into your existing `mcpServers` block (create one if absent):

   ```json
   {
     "mcpServers": {
       "github": {
         "command": "docker",
         "args": [
           "run",
           "-i",
           "--rm",
           "-e",
           "GITHUB_PERSONAL_ACCESS_TOKEN",
           "ghcr.io/github/github-mcp-server"
         ],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PERSONAL_ACCESS_TOKEN}"
         }
       }
     }
   }
   ```

   The `${env:…}` interpolation tells Claude Code to read the token from the local env var. If you stored it inline instead, replace with the raw token string (kept out of git!).

4. **Restart Claude Code** so it picks up the new MCP server. The next session will surface tools prefixed `mcp__github__*`.

## What it unlocks

Once installed, Claude can call typed tools like:

- `mcp__github__list_workflow_runs` — replaces my `gh run list` calls
- `mcp__github__get_workflow_run_logs` — replaces `gh run view --log-failed`
- `mcp__github__create_pull_request` — opens PRs without shelling out
- `mcp__github__list_issues` / `mcp__github__create_issue`
- File-content read / push without round-tripping git

The Session 82 CI debug cycle (3 rounds of guessing → 1 round with `gh` evidence) gets even tighter — Claude can pull failure traces inline as part of a single tool plan rather than chaining shell commands.

## Verify

After restart, in a Claude Code session, ask Claude to list recent workflow runs. It should call `mcp__github__list_workflow_runs` directly instead of shelling out to `gh`. If the tool fails with an auth error, double-check the token's scopes + that the env var is exported in the shell Claude Code launched from.

## Trade-offs

- **Pro**: typed access, no string-parsing fragility, supports a richer surface than `gh` (notifications, security alerts, organization data).
- **Con**: requires Docker running locally; first invocation pulls the image (~30s). On the corporate AppLocker environment, verify Docker is allowed.
- **Con**: another dependency to maintain — the image version is `latest` by default; pin to a specific tag if reproducibility matters.

## Fallback

The existing `gh` CLI shim at `~/bin/gh` keeps working. The two coexist — Claude picks the MCP when it's available and falls back to the CLI when it isn't.
