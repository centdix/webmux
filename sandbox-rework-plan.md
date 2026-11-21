# Plan : refonte du sandbox Docker

## Objectif

Un profil sandbox doit se réduire à :

```yaml
sandbox:
  runtime: docker
  # optionnel : image, mounts, envPassthrough, yolo, systemPrompt, panes
```

Dans ce sandbox, l'agent doit pouvoir :

- utiliser n'importe quel harness (claude, codex, opencode, pi, agent custom) ;
- utiliser les creds git/GitHub de l'utilisateur (clone, push, `gh pr create`) ;
- tout installer (root via sudo) et cloner n'importe quel repo.

Le tout sans que l'utilisateur ait à construire une image ou à monter des dossiers à la main.

**Modèle de menace.** L'agent est de confiance. Le sandbox sert à protéger l'hôte des accidents, pas à contenir un agent hostile. Conséquences :

- pas de proxy de creds ni d'allowlist réseau ;
- le seul vrai trou à fermer est l'exécution de code sur l'hôte via `.git/hooks` et `.git/config`.

**Hors scope** (à noter dans `sandbox-rework-followups.md` s'ils reviennent) :

- backends `sbx` et Kubernetes ;
- runtime gVisor ;
- publication d'image sur un registry ;
- réseau autre que `--network host` ;
- support des onglets et du chat Codex en docker.

## État actuel (résumé)

| Élément | Fichier / comportement |
|---|---|
| Lancement du conteneur | `backend/src/adapters/docker.ts` : `launchContainer` / `buildDockerRunArgs`, `docker run -d … <image> sleep infinity` |
| Utilisateur | `--user <uid>:<gid>` + `HOME=/root` ; ne marche que grâce à `chmod -R 777 /root` dans `sandbox-image/Dockerfile.sandbox` |
| Montages | worktree (rw), `<repo>/.git` (rw), `<repo>` (ro), aux mêmes chemins que sur l'hôte. En dur : `~/.claude`, `~/.claude.json`, `~/.codex`, et `~/.gitconfig`, `~/.ssh`, `~/.config/gh` en ro. Le socket SSH n'est monté que s'il est accessible à tous |
| CLI webmux | bundle JS de l'hôte + wrapper `bun` montés ; l'image doit donc fournir `bun` |
| Panes | `buildDockerShellCommand` dans `backend/src/services/agent-service.ts` = `docker exec -it -w <wt> <ctr> /bin/sh -c …` ; c'est le process de **chaque** pane (`planSessionLayout`). La commande de l'agent est tapée dans ce shell, `buildDockerAgentPaneCommand` n'a donc pas de `docker exec` |
| Cycle de vie | `backend/src/services/lifecycle-service.ts` : `materializeRuntimeSession` (launch), `removeResolvedWorktree` / `cleanupFailedCreate` / changement de profil (`removeContainer`) |
| Config | `ProfileConfig.image` est obligatoire pour docker (`isDockerProfile` dans `backend/src/adapters/config.ts`) |
| Découverte des sessions | les adapters d'agents (`backend/src/agents/*.ts`, ex. `listClaudeSessionIds`) lisent `~/.claude/projects/<cwd encodé>` **sur l'hôte**. Ça marche parce que `~/.claude` est monté et que le cwd est identique. **À conserver** |

## Décisions de design

1. **Utilisateur dans le conteneur.**
   - `docker run` démarre en root avec un entrypoint **injecté par webmux** : un script écrit dans le state dir, monté en ro, passé via `--entrypoint`. Ça le rend compatible avec n'importe quelle image.
   - Cet entrypoint crée l'utilisateur `webmux` avec l'UID/GID de l'hôte (`-o` si l'UID existe déjà), `HOME=/home/webmux`, sudo sans mot de passe si `sudo` existe, puis `exec sleep infinity`.
   - Les panes font `docker exec -u <uid>:<gid> -e HOME=/home/webmux`.
   - Résultat : les fichiers écrits dans le worktree appartiennent à l'utilisateur, et il n'y a plus de `chmod 777`.
2. **Creds git sans monter `~/.ssh` / `~/.gitconfig` / `~/.config/gh`.**
   - **Token GitHub.** On résout un token sur l'hôte au lancement, dans cet ordre : `GH_TOKEN`, puis `GITHUB_TOKEN`, puis `gh auth token`. On le passe en `GH_TOKEN`, ce qui suffit aussi pour `gh`.
   - **Config git injectée via `GIT_CONFIG_COUNT/KEY_n/VALUE_n`** (le mécanisme existe déjà pour `safe.directory`) :
     - `credential.https://github.com.helper` = `""` (reset), puis `!f() { test "$1" = get && echo username=x-access-token && echo "password=$GH_TOKEN"; }; f`
     - `url.https://github.com/.insteadOf` = `git@github.com:` et `ssh://git@github.com/` (seulement si un token existe), pour que les remotes SSH passent par le token
     - `push.autoSetupRemote` = `true` (voir point 4)
   - **Identité git.** `user.name` / `user.email` sont lus sur l'hôte (`git config --get`) et passés en `GIT_AUTHOR_NAME/EMAIL` + `GIT_COMMITTER_NAME/EMAIL`.
   - **Agent SSH, gardé pour les remotes non-GitHub.**
     - Linux : on monte `SSH_AUTH_SOCK` sans la condition « accessible à tous ». L'utilisateur du conteneur a le même UID, il peut donc y accéder.
     - macOS (Docker Desktop / OrbStack) : on monte `/run/host-services/ssh-auth.sock`.
3. **Harness déclaratifs.**
   - Chaque `AgentAdapter` déclare un `sandbox: AgentSandboxSpec` : la commande d'install, les chemins sous `$HOME` à monter (rw, seulement s'ils existent sur l'hôte) et les variables d'auth à passer si elles sont définies.
   - Les CLI sont installés à la demande dans un **volume nommé partagé** `webmux-sandbox-tools`, monté sur `/opt/webmux/tools`, sous un `flock` pour gérer deux conteneurs qui démarrent en même temps.
   - L'install est préfixée à la commande du pane agent, pour que l'utilisateur voie la progression la première fois.
   - `bun` (nécessaire au CLI webmux) s'installe dans le même volume.
   - Les agents custom gagnent un champ optionnel `sandboxInstall`.
4. **Durcissement git.**
   - On monte en **ro**, par-dessus le `.git` rw, `<repo>/.git/hooks` et `<repo>/.git/config`.
   - **Testé à la main** (docker + git, bind mount ro sur `.git/config`) :
     - `git push -u` pousse et sort en 0, mais l'upstream n'est pas enregistré (« Device or resource busy ») ;
     - un `git push` suivant marche grâce à `push.autoSetupRemote=true` ;
     - `git config core.fsmonitor …` échoue et l'écriture dans `hooks/` échoue : c'est le but.
   - Limite connue : `git pull` sans argument n'a pas d'upstream. L'ajouter dans `systemPrompt` n'est pas nécessaire.
5. **Image par défaut construite localement.**
   - webmux embarque un Dockerfile slim et le construit à la demande (`docker build`) avec un tag dérivé d'un hash du contenu : `webmux-sandbox:<hash12>`.
   - Contenu : debian slim, git, curl, ca-certificates, sudo, openssh-client, unzip, build-essential, Node 22, gh.
   - Pas de registry, donc pas de CI à maintenir.
   - `image:` devient optionnel ; une image custom doit juste fournir `sh`, `useradd` (ou `adduser` busybox), git, curl, et Node/npm pour les installs d'agents.
   - L'ancien `sandbox-image/` est supprimé.
6. **Timeouts.** On sépare la préparation de l'image (`docker image inspect`, puis `docker pull` ou `docker build`, timeout 10 min, logs) du `docker run` (le timeout de 60 s ne porte plus que là-dessus).

## Types et contrats

```ts
// backend/src/agents/types.ts
export interface AgentSandboxSpec {
  /** Shell exécuté dans le conteneur si `binary` est absent du PATH.
   *  Env fourni : NPM_CONFIG_PREFIX=/opt/webmux/tools, BUN_INSTALL=/opt/webmux/tools/bun. */
  install: string;
  /** Chemins relatifs à $HOME, montés rw de l'hôte vers /home/webmux/<path> s'ils existent. */
  homeMounts: readonly string[];
  /** Variables d'env de l'hôte transmises si définies (auth de l'agent). */
  authEnv: readonly string[];
}
// AgentAdapter gagne : sandbox: AgentSandboxSpec
```

Valeurs initiales :

| Agent | install | homeMounts | authEnv |
|---|---|---|---|
| claude | `npm i -g @anthropic-ai/claude-code` | `.claude`, `.claude.json` | `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY` |
| codex | `npm i -g @openai/codex` | `.codex` | `OPENAI_API_KEY` |
| opencode | `npm i -g opencode-ai` | `.local/share/opencode`, `.config/opencode` | — |
| pi | `npm i -g @earendil-works/pi-coding-agent` | `.pi` | — |

On monte les `homeMounts` de **tous** les agents built-in qui existent sur l'hôte (pour pouvoir changer d'agent sans relancer le conteneur), mais on n'installe que l'agent du worktree.

```ts
// backend/src/domain/config.ts
export interface CustomAgentConfig {
  label: string;
  startCommand: string;
  resumeCommand?: string;
  sandboxInstall?: string; // nouveau
}
// ProfileConfig.image reste `image?: string` ; DockerProfileConfig n'impose plus image.
```

```ts
// backend/src/adapters/docker.ts
export interface SandboxCredentials {
  ghToken: string | null;
  gitIdentity: { name: string; email: string } | null;
  sshAuthSock: string | null; // chemin hôte (Linux) ou "/run/host-services/ssh-auth.sock" (macOS)
}
export interface DockerGateway {
  launchContainer(opts: LaunchContainerOpts): Promise<string>;
  removeContainer(branch: string): Promise<void>;
}
// buildDockerRunArgs reste pure : credentials, uid/gid, home, image résolue, agent specs passés en paramètres.
```

Les commandes `docker exec` (shell + agent) sont construites dans un seul helper : `buildDockerExecCommand` dans `agent-service.ts`, qui prend `user` et `home`. Pas de duplication.

**API HTTP : aucun nouvel endpoint.** Le seul champ exposé en plus est `sandboxInstall` sur les agents custom, qui passe par les endpoints existants de lecture/écriture des agents custom. Vérifier où ils sont définis (`frontend/src/lib/api.ts`, `CustomAgentsSection.svelte`, backend).

## Étapes (une PR draft par étape, en stack via gh-stack, sur le fork `centdix/webmux`)

### PR 1 : utilisateur et entrypoint injecté

- Générer l'entrypoint (fonction pure `buildSandboxEntrypoint()` + écriture dans `webmuxRuntimeStateDir()/docker/entrypoint.sh`, comme le wrapper CLI existant). Il doit :
  - créer le groupe et l'utilisateur (gérer un UID/GID déjà existant, et busybox `adduser`/`addgroup` en fallback) ;
  - créer `/home/webmux`, `chown` non récursif de `/home/webmux` et des dossiers intermédiaires créés en root par docker (`find /home/webmux -xdev -maxdepth 3 -type d -user 0 -exec chown …`) ;
  - `chown` de `/opt/webmux/tools` ;
  - configurer sudoers si `sudo` est présent ;
  - finir par `exec sleep infinity`.
- `buildDockerRunArgs` :
  - retirer `--user` ;
  - ajouter `--entrypoint /opt/webmux/entrypoint.sh`, `-e WEBMUX_UID`, `-e WEBMUX_GID`, `HOME=/home/webmux` ;
  - déplacer les montages `/root/...` vers `/home/webmux/...`.
- `docker exec` : `-u uid:gid -e HOME=/home/webmux`. Mettre à jour `DOCKER_PATH_FALLBACK` (qui pointe sur `/root/...`).
- Séparer la préparation de l'image et son timeout (décision 6).
- Tests :
  - `docker.test.ts` (args) et `agent-service.test.ts` (exec) ;
  - test unitaire du script généré ;
  - test manuel avec une vraie image (`oven/bun:1-debian` ou `debian:bookworm-slim`) : fichier créé dans le worktree appartient à l'utilisateur hôte, `sudo apt-get install` marche.

### PR 2 : creds git et durcissement

- Résoudre `SandboxCredentials` dans `launchContainer` (I/O), et les passer à `buildDockerRunArgs` (pur).
- Ajouter les entrées `GIT_CONFIG_*` de la décision 2 et `push.autoSetupRemote`. Ajouter les clés aux `reservedKeys`.
- Supprimer les montages `~/.gitconfig`, `~/.ssh`, `~/.config/gh` et la condition « socket accessible à tous ».
- Montages ro `.git/hooks` et `.git/config` ; créer `.git/hooks` côté hôte s'il manque, sinon le bind mount échoue.
- Tests unitaires sur les args (avec et sans token, macOS vs Linux pour le socket).
- Tests manuels :
  - `git clone` d'un repo privé ;
  - `git push` sur une branche de test du fork ;
  - `gh auth status` ;
  - échec d'écriture dans `hooks/` et de `git config core.fsmonitor`.

### PR 3 : harness déclaratifs

- `AgentSandboxSpec` sur chaque adapter (tableau ci-dessus).
- Volume `webmux-sandbox-tools` → `/opt/webmux/tools` ; `PATH` du conteneur = `/opt/webmux/tools/bin:/opt/webmux/tools/bun/bin:$PATH`.
- Préfixe d'install dans la commande du pane agent (helper pur dans `agent-service.ts`) : `flock /opt/webmux/tools/.lock sh -c 'command -v <binary> >/dev/null || <install>'`.
  - Faire pareil pour `bun` si le CLI webmux est monté.
  - Agents custom : utiliser `sandboxInstall` s'il existe, sinon rien.
- Monter les `homeMounts` existants et transmettre les `authEnv` définis. Supprimer les montages claude/codex en dur.
- `sandboxInstall` pour les agents custom : parsing de la config, type frontend dans `frontend/src/lib/types.ts`, champ dans `CustomAgentsSection.svelte`, et parité CLI si une commande CLI gère les agents custom (sinon le fichier `~/.config/webmux/config.yaml` fait office de surface CLI : le documenter).
- Tests :
  - unitaires (préfixe d'install, montages par agent, authEnv) ;
  - frontend (`CustomAgentsSection.test.ts`) ;
  - manuel : premier lancement claude dans une image sans claude → s'installe ; second worktree → réutilise le volume ; resume d'une session claude depuis le dashboard.

### PR 4 : image par défaut, config et docs

- Dockerfile slim embarqué (constante ou fichier inclus dans le bundle, vérifier comment `bin/` est bundlé), avec `ensureDefaultImage()` qui fait `docker image inspect` puis, si absente, `docker build -t webmux-sandbox:<hash12> -` depuis stdin.
- `image` optionnel :
  - `isDockerProfile` ne l'exige plus ;
  - supprimer `requireDockerProfile` et l'erreur 422 « missing an image » ;
  - mettre à jour les tests de config.
- Supprimer `sandbox-image/`.
- Mettre à jour `README.md` (section Docker Sandbox Mode, tableau de config, exemple), `.webmux.example.yaml`, et le prompt de `webmux init` / `init-authoring` s'il mentionne l'image.
- Test manuel de bout en bout via `scripts/run-with-isolated-tmux.sh bun bin/webmux.js serve --port $(webmux port e2e)` avec un projet de test dont le profil est juste `runtime: docker` :
  - création d'un worktree ;
  - l'agent démarre ;
  - `webmux port` marche dans le conteneur ;
  - commit + push ;
  - suppression du worktree, qui supprime le conteneur.

## Règles pour l'implémentation

- Suivre `AGENTS.md`, `backend/CLAUDE.md`, `frontend/CLAUDE.md` et `docs/autonomous-mode.md`.
- Garder les fonctions de construction d'args/commandes **pures** et testées ; l'I/O reste dans `launchContainer`.
- Ne pas toucher au serveur webmux de l'utilisateur (systemd :5111) ni au tmux live. Tests tmux via `scripts/run-with-isolated-tmux.sh`, ports via `webmux port <label>`.
- Checks par PR : `bun test` (backend + bin), `bun run check` dans `frontend` si le frontend est touché.
- Ce qui sort du scope va dans `sandbox-rework-followups.md`, pas dans le code.
