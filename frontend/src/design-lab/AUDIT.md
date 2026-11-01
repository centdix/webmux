# Sidebar audit

## What the current sidebar shows

### Sidebar header / footer (`App.svelte`)
- Always: "webmux" title, "+ New" button, search field, "Show archived (n)" toggle.
- Conditional: creation spinner line ("Creating 2 worktrees…").
- Footer: "+ Add project", optional Linear panel, 3 keyboard hints (Cmd+Up/Down, Cmd+K = new worktree, Cmd+D = remove) taking ~70px permanently.

### Per project (`WorktreeProjectHeader` + `ProjectActionsMenu`)
- Always: chevron, bold name (as loud as a page title), worktree count.
- Collapsed only: waiting / error / unread counts.
- Hover only: "+" (new worktree here) and ⋮ menu: New worktree, Pull <repo> (per linked repo), Open in IDE (per repo), Remove project.
- Error: red line "Failed to load worktrees: …" under the header.

### Per worktree row (`WorktreeList`)
- Always: label or branch (2 lines when a label exists), agent status icon (working/waiting/error/done-unread only), ☆/★ favorite button (always visible, even when off).
- Badge row (wraps): oneshot, archived, creation phase + spinner, opening…, closed, one pill per PR (state color only), Linear issue.
- Meta line: agent label (Claude/Codex), profile.
- Services line: `name:port` per service, green when running.
- Opacity: closed 50%, archived 70%, busy 40%.
- Hover only: ⋮ menu: Close, Archive/Restore, Change profile…, Create sub-worktree, Remove, Post conversation to Linear.
- Keyboard only: Cmd+Up/Down to move, Cmd+D remove, Cmd+Enter open a closed worktree.
- Floating "above/below" pills: waiting/error/unread counts for rows scrolled out of view.

### Problems
- A row is 2 to 5 lines tall depending on data, so the list has no rhythm and 10 worktrees overflow.
- PR pills show state only. CI failing, review comments and "ready to merge" are invisible (they only appear in the TopBar).
- The favorite star, `svc:port` and agent/profile lines are always visible, which is noise for a selector.
- Every action sits behind two different hover-only ⋮ menus. You can't discover them on touch or with the keyboard.
- Project headers are bold and sticky with hidden actions. Statuses only show when a project is collapsed.
- "Done" without unread shows nothing. "Idle" and "done-read" look alike, which is fine, but "closed" is just dimmed text.

## Data available per worktree
- Identity: project, branch, label, baseBranch (sub-worktree nesting), path.
- Agent: `agent` = working / waiting / error / done / idle, agentName/agentLabel (Claude, Codex…), agentTerminalStale, tabs (root + forks), elapsed.
- Unread: worktree has an unread notification (agent_stopped, pr_opened, runtime_error, worktree_auto_removed).
- Git: dirty, unpushed.
- PRs (per repo): number, state open/closed/merged, isDraft, ciStatus none/pending/success/failed + checks, review comments.
- Lifecycle: mux open/closed, creating + creationPhase, opening, archived, source ui/oneshot.
- Extras: profile, services (name, port, running), Linear issue (identifier, state + color), favorite (client-side).

## What matters at a glance (keep in the sidebar)
1. **Needs me now**: waiting (agent asked a question), error, unread done. These must be visible whatever the scroll, collapse or project.
2. **Running**: working agents, creations in progress.
3. **PR outcome**: CI failed or review comments (needs me), ready to merge (open, non-draft, CI green, no comments), merged (can be cleaned up).
4. Name of the worktree (label > branch), and which project it belongs to.
5. Project-level health: load error, counts of items that need me.

## What can move elsewhere
- Close / archive / remove / change profile / post to Linear: these already exist in the **TopBar** of the selected worktree. In the sidebar they become a right-click **context menu** (with a visible ⋯ only on the selected row).
- Agent kind, profile, services/ports, dirty/unpushed, tab count: shown in the TopBar or as a hover tooltip.
- Favorite toggle: context menu. Only the filled star or pin shows.
- Project actions (pull, open in IDE, remove): project context menu. A per-project "+" stays reachable from the header on hover and focus.
- Keyboard hints footer: a single `?` or in Settings. Cmd+K is today "new worktree" (there is no command palette yet).
- Archived: a filter or a collapsed "Archived (n)" group, not a toggle that permanently takes a line.
