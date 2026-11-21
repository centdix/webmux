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
