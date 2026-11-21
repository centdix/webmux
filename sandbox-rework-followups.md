# Sandbox rework: follow-ups

Out of scope for the 4-PR stack in `sandbox-rework-plan.md`. Each item says where it came from.

## Git hardening (PR 2)

- **Single-file ro mount of `.git/config` goes stale.** Git rewrites config by rename, so a host-side write (`git remote add`, `git config`, `git push -u` on the host, or webmux's own `git worktree add -b … <remote start point>`) gives the file a new inode. Running containers keep the old content until they are recreated. Option: mount `.git` ro and only the subdirs git writes (objects, refs, logs, `worktrees/<name>`, index, packed-refs…) rw.
- **Submodules:** `.git/modules/*/{config,hooks}` stay writable, and host `git status` recurses into submodules and reads their `core.fsmonitor`.
- **`core.hooksPath` inside the worktree** (for example husky's `.husky/_`) runs worktree-controlled hooks on the host. Same class as running `npm test` on the host. Document it, or accept it.
- **Gitfile repos** (`--separate-git-dir`, a submodule checkout as the project root): hardening is skipped with a warning. Resolve `git rev-parse --git-common-dir` instead.
- **Credentials are frozen into a reused container.** A rotated token or a new `SSH_AUTH_SOCK` (an `ssh -A` socket dies at logout) is not picked up until the container is recreated. Containers created by PR 1 builds pass the readiness check and are reused without hardening. Option: put a version label on containers and recreate on mismatch.
- **Token visibility:** `-e GH_TOKEN=<token>` shows in host `ps` while `docker run` executes, and in `docker inspect`. Option: pass `-e GH_TOKEN` and set it in the spawn env.
- **The SSH→HTTPS rewrite catches all GitHub SSH remotes.** A narrow or SSO-restricted token breaks remotes the forwarded SSH agent could have served. `ssh://git@github.com:22/…` and SSH host aliases are not rewritten.
- **Partial git identity:** if only one of `user.name`/`user.email` is set on the host, neither is forwarded.
- **`git pull` with no argument** has no upstream, because `.git/config` is read-only (known limitation, per the plan).

## Agent harnesses (PR 3)

- **No host `~/.claude` means no resume.** Agent home dirs are mounted only if they exist on the host, so a Docker-only user without `~/.claude` (or `~/.codex`) gets sessions stored only in the container. Host-side session discovery then finds nothing, and the sessions disappear with the container. Fix: create the worktree agent's home *directories* on the host before launch. Don't create single-file entries like `.claude.json`: docker would create them as root-owned dirs.
- **Auth secrets on argv:** `-e ANTHROPIC_API_KEY=<value>` (like `GH_TOKEN`) is visible in host `ps`. Pass `-e KEY` without a value and inherit it from the spawn env.
- **Stale agents in the tools volume:** the install is skipped once the binary is on the PATH. Self-updates now land in the volume (`NPM_CONFIG_PREFIX` is exported at runtime), but run without the lock. A forced refresh is `docker volume rm webmux-sandbox-tools`. Because tools come first on the PATH, a volume copy wins over a newer binary in the image.
- **Custom installs with no binary** take the global tools lock on every launch.
- **Forked tabs in docker worktrees:** `createWorktreeTab` builds the host command (no install step, no tools PATH, no `docker exec`), and forked-tab restore skips docker. Tabs in docker are out of scope per the plan.

## Default image and e2e (PR 4)

- **Old default images pile up:** each Dockerfile change creates a new `webmux-sandbox:<hash>` tag, and old tags are never pruned.
- **Root-owned parents of mount targets outside `$HOME`:** docker creates them as root. A worktree under `/tmp/claude-<uid>/…` makes Claude Code refuse its temp dir (`/tmp/claude-<uid>` owned by uid 0). This was found in e2e because the test project lived in the session scratchpad. Real worktree roots are rarely there, but the entrypoint could hand over `/tmp/claude-$uid` when docker created it.
- **`webmux close` keeps the container** and `open` reuses it (existing behavior). Credentials and mounts are therefore only refreshed by `remove` or a profile change.
- **Dashboard-click resume:** resume was verified through the same lifecycle path via `webmux close` / `webmux open`, not by clicking in the dashboard.
