# Changelog

## [0.44.0](https://github.com/centdix/webmux/compare/v0.43.1...v0.44.0) (2026-11-01)


### Features

* add --app flag for browser app mode ([#143](https://github.com/centdix/webmux/issues/143)) ([62b68a8](https://github.com/centdix/webmux/commit/62b68a8df0b8e3db8bd53cc45615e2584d4e1df5))
* add --detach/-d flag to webmux add command ([#159](https://github.com/centdix/webmux/issues/159)) ([0e144f6](https://github.com/centdix/webmux/commit/0e144f6d313a566a38388663bac505ee465ea938))
* add --existing flag to `wm add` for resuming work on remote branches ([0cae50c](https://github.com/centdix/webmux/commit/0cae50c86286b8859143e15e90000a4c98c27a54))
* add --version / -V flag ([#101](https://github.com/centdix/webmux/issues/101)) ([4d3e614](https://github.com/centdix/webmux/commit/4d3e6147605a92d9f6fd6eeb2851e3697feeac1b))
* add `webmux send` CLI command ([#172](https://github.com/centdix/webmux/issues/172)) ([4a915dc](https://github.com/centdix/webmux/commit/4a915dc8e8e816a139e45641815242b9e71624c0))
* add `webmux serve` command, bare `webmux` now shows help ([#90](https://github.com/centdix/webmux/issues/90)) ([e1ca9f5](https://github.com/centdix/webmux/commit/e1ca9f5a7d2a0dcec8f37264bd861c17160a0ff8))
* add `wmdev init` onboarding command ([#65](https://github.com/centdix/webmux/issues/65)) ([6e8b128](https://github.com/centdix/webmux/commit/6e8b128785d716bf38cd1a3ea0d45f9837941ec3))
* add `wmdev service` command for running as a system daemon ([#67](https://github.com/centdix/webmux/issues/67)) ([39ba997](https://github.com/centdix/webmux/commit/39ba99704482ea5bfb8567a632b741df3e6bb623))
* add a notification center keyed by project and id ([26fb03b](https://github.com/centdix/webmux/commit/26fb03bd03d78e49977f642bf25d69b8b494a0c8))
* add auto-close on merge and auto-pull main ([#173](https://github.com/centdix/webmux/issues/173)) ([c6ae6f1](https://github.com/centdix/webmux/commit/c6ae6f1d69262180751fefcf0f4b105ac19c4c00))
* add claude conversation streaming ([#262](https://github.com/centdix/webmux/issues/262)) ([6b04e83](https://github.com/centdix/webmux/commit/6b04e8344a0f8295369c018a7331511d348a6b54))
* add codex agent lifecycle hooks ([#229](https://github.com/centdix/webmux/issues/229)) ([133e8cd](https://github.com/centdix/webmux/commit/133e8cd349edeaafcc3050bfa4246b1bda84e171))
* add command pane workingDir ([#169](https://github.com/centdix/webmux/issues/169)) ([84fcb2e](https://github.com/centdix/webmux/commit/84fcb2e2b5d609f76424c1f261b74dd6e4f9c701))
* add create sub-worktree shortcut to worktree menu ([#269](https://github.com/centdix/webmux/issues/269)) ([f40807f](https://github.com/centdix/webmux/commit/f40807f2445c418be22ed12e959c11b9297a9309))
* add custom agents and multi-agent worktrees ([#222](https://github.com/centdix/webmux/issues/222)) ([ef76e92](https://github.com/centdix/webmux/commit/ef76e924e5c4b823c72049829ea2917d066906c9))
* add existing branch worktree picker ([#119](https://github.com/centdix/webmux/issues/119)) ([93e0bd8](https://github.com/centdix/webmux/commit/93e0bd806b13eafecdc07d5cdc73272f631b48de))
* add favorite worktrees pinned to the top of the list ([b4c6929](https://github.com/centdix/webmux/commit/b4c69290acc3f9299f471e1f1ef52e1abc4f12d5))
* add forkable tabs for claude/codex agent sessions ([39bb904](https://github.com/centdix/webmux/commit/39bb904b729b38fd51ca70bed4e168ebcfd20f76))
* add fuzzy search, description preview, and clickable tiles to Linear panel ([#57](https://github.com/centdix/webmux/issues/57)) ([b03be8a](https://github.com/centdix/webmux/commit/b03be8a48c8c9164fda87095c89b01f67f658122))
* add hub endpoint listing worktrees of all projects ([c3d81ee](https://github.com/centdix/webmux/commit/c3d81ee7a3d5044ca6176e20e2a7213a6517655c))
* add linear ticket worktree option ([#163](https://github.com/centdix/webmux/issues/163)) ([e52caf5](https://github.com/centdix/webmux/commit/e52caf5d7f8d53488a58382515425f0ddb961443))
* add localstorage favorite worktrees pinned to the top of the list ([ba4d64e](https://github.com/centdix/webmux/commit/ba4d64e7b474db8c911545ef516f4e86a919c490))
* add mobile more button for PR badges, CI, and comments ([#122](https://github.com/centdix/webmux/issues/122)) ([f9a8c37](https://github.com/centdix/webmux/commit/f9a8c37f3e15cd93779cbd8bfdf57b9ac5de489e))
* add name field to config for custom dashboard title ([#56](https://github.com/centdix/webmux/issues/56)) ([0e7878c](https://github.com/centdix/webmux/commit/0e7878c16db41f8d85e9a75386dde168e4758ef5))
* add native terminal launch endpoint ([#158](https://github.com/centdix/webmux/issues/158)) ([11ff5aa](https://github.com/centdix/webmux/commit/11ff5aa896dd4441c5a6724a0eb3143cce5a3bd2))
* add native webmux lifecycle commands ([#83](https://github.com/centdix/webmux/issues/83)) ([41818f7](https://github.com/centdix/webmux/commit/41818f7339b37620fd0e3b9d4c24d001bda3a011))
* add non-terminal chat ui for codex and claude ([#216](https://github.com/centdix/webmux/issues/216)) ([bd1b91a](https://github.com/centdix/webmux/commit/bd1b91a2af6a39c8a0fd75aff746bf110f8d0d74))
* add opencode as a built-in agent ([#10](https://github.com/centdix/webmux/issues/10)) ([f25cb95](https://github.com/centdix/webmux/commit/f25cb95afaccfa7e1354a389edbc1de9984c7a16))
* add paired claude and codex worktrees ([#193](https://github.com/centdix/webmux/issues/193)) ([004404f](https://github.com/centdix/webmux/commit/004404f5769633e09ce64529ce165eeee4e74dd1))
* add per-project header actions and an add-project entry in place of the project switcher ([5788929](https://github.com/centdix/webmux/commit/578892916a548e67d18852b5a631aebb127ce407))
* add pi as a built-in agent ([#13](https://github.com/centdix/webmux/issues/13)) ([d1f61d8](https://github.com/centdix/webmux/commit/d1f61d896ef4c9b0a352291945ffce22c102f279))
* add process-wide port registry surfaced as worktree services ([c2a9898](https://github.com/centdix/webmux/commit/c2a98987b02b83c25b925e6784110cedebfaa423))
* add remote branch toggle for existing branches ([#176](https://github.com/centdix/webmux/issues/176)) ([d55448e](https://github.com/centdix/webmux/commit/d55448e2f1b4115a57cd35d4d9933dfb0b3dfd28))
* add reusable Toggle component for boolean startup envs ([#154](https://github.com/centdix/webmux/issues/154)) ([c748618](https://github.com/centdix/webmux/commit/c7486188651aa59b82a8dcf440a882f8eaeb3045))
* add settings icon with theme selection ([#130](https://github.com/centdix/webmux/issues/130)) ([972e38e](https://github.com/centdix/webmux/commit/972e38eff5581466429f2f850bbcb9bf0ee56e25))
* add shared icon button, context menu and one-glyph row status and PR signal pieces ([2638641](https://github.com/centdix/webmux/commit/2638641efcb79d11891461c3b3fa1a3cdcd40d74))
* add shell autocompletion for CLI commands ([#100](https://github.com/centdix/webmux/issues/100)) ([d08512d](https://github.com/centdix/webmux/commit/d08512de69ba2b7315371ecbeeb49ecdd29eec2d))
* add startup environment variables config ([#59](https://github.com/centdix/webmux/issues/59)) ([7ee49f4](https://github.com/centdix/webmux/commit/7ee49f46310b5356b35e0e1df68ced88855d74bc))
* add web chat ui setting ([#252](https://github.com/centdix/webmux/issues/252)) ([4126a4c](https://github.com/centdix/webmux/commit/4126a4c336e355dd0117f4fe1f9dae361eea9f87))
* add webmux list --all-projects ([5918ff8](https://github.com/centdix/webmux/commit/5918ff84b3ea8f9b3c3d4067b6a1e0bf3a38f65c))
* add webmux list --all-projects ([6fcfc55](https://github.com/centdix/webmux/commit/6fcfc55cf3c50d80c1a6195bb48d152489667a6c))
* add webmux list command and auto-attach tmux on add ([#85](https://github.com/centdix/webmux/issues/85)) ([07c199d](https://github.com/centdix/webmux/commit/07c199d87d77cad28f97c1b14513fce80edcc876))
* add webmux local yaml overlays ([#129](https://github.com/centdix/webmux/issues/129)) ([37b005d](https://github.com/centdix/webmux/commit/37b005d0aa9299523a18d2847222e12cb7827af8))
* add webmux port command and worktree port endpoints ([b398e5d](https://github.com/centdix/webmux/commit/b398e5dc65681ac4e926e684d365dba3e068fac5))
* add webmux prune command ([#118](https://github.com/centdix/webmux/issues/118)) ([eda234a](https://github.com/centdix/webmux/commit/eda234a810e91209bf130eecc81e674be2d8edda))
* add webmux update command ([#92](https://github.com/centdix/webmux/issues/92)) ([3f64a25](https://github.com/centdix/webmux/commit/3f64a258e641bd5ea25077c7d19593b12f22250c))
* add workspace labels ([#231](https://github.com/centdix/webmux/issues/231)) ([04162db](https://github.com/centdix/webmux/commit/04162dba0af9cfaf348d8e35195a4b64a96023cc))
* add worktree base branch support ([#170](https://github.com/centdix/webmux/issues/170)) ([8d9a04b](https://github.com/centdix/webmux/commit/8d9a04b3f88704404f37cc96ee3f975d81db2c82))
* add worktree refs and a store polling every project's worktrees ([444d8b6](https://github.com/centdix/webmux/commit/444d8b66004352d56bb53a543b67e59babeb43de))
* add worktree search and archive controls ([#206](https://github.com/centdix/webmux/issues/206)) ([c68b8da](https://github.com/centdix/webmux/commit/c68b8daf156538682339f0c51d9e419b19457103))
* advertise webmux port in the agent system prompt ([4a3774a](https://github.com/centdix/webmux/commit/4a3774a33de02a8d619682bcbca45d573847887f))
* AI-polish Linear issue titles in web create-ticket path ([fd8ecf6](https://github.com/centdix/webmux/commit/fd8ecf6b8217af74089bea0be6a41c328fa83d1f))
* AI-polish Linear issue titles in web create-ticket path ([9d505bf](https://github.com/centdix/webmux/commit/9d505bfe23f57dd017bfa55f5d4c4746c8db0688))
* allow linear auto-create poll interval override via env var ([#5](https://github.com/centdix/webmux/issues/5)) ([4d3a5ba](https://github.com/centdix/webmux/commit/4d3a5ba6fe817e70ac216b1a14acf9f35e673549))
* allow worktreeRoot override from webmux.local.yaml ([#146](https://github.com/centdix/webmux/issues/146)) ([241f39d](https://github.com/centdix/webmux/commit/241f39d5916e34a118083987020a5188ba7a607e))
* auto-create worktrees for Linear tickets ([#160](https://github.com/centdix/webmux/issues/160)) ([53afe95](https://github.com/centdix/webmux/commit/53afe95b28df9104fd8965eb2e06a3054c36363e))
* auto-pick a free port in webmux service install ([#243](https://github.com/centdix/webmux/issues/243)) ([052f5f9](https://github.com/centdix/webmux/commit/052f5f90ad7fcb61a4d8ae426e5bc565cc5b5624))
* bake env vars into webmux service unit via --env and auto-pickup ([b790a50](https://github.com/centdix/webmux/commit/b790a50230b1aa137e04ed4efaeea34cd62cd58c))
* bake env vars into webmux service unit via --env and auto-pickup ([88e111d](https://github.com/centdix/webmux/commit/88e111db9cd3c7ba6376d76368f63d6dba9eb250))
* change default worktree root from __worktrees to ../worktrees ([dd4fbed](https://github.com/centdix/webmux/commit/dd4fbed4bbb0daa4d30a6a302fe845ff8b36dcb3))
* clearer worktree status indicators ([#265](https://github.com/centdix/webmux/issues/265)) ([4b528a7](https://github.com/centdix/webmux/commit/4b528a7aa2fdad404fd869979b053e89607ced95))
* close dialog on outside click ([#151](https://github.com/centdix/webmux/issues/151)) ([908af94](https://github.com/centdix/webmux/commit/908af94edb3d40c0d8adf22ae57d8ac84b32a07e))
* diff toggle, badge labels, and comment sorting ([#150](https://github.com/centdix/webmux/issues/150)) ([a9fe654](https://github.com/centdix/webmux/commit/a9fe654a87779078a587d234c31981afed06b83c))
* dirty badge diff dialog ([#148](https://github.com/centdix/webmux/issues/148)) ([4cd95dd](https://github.com/centdix/webmux/commit/4cd95ddcc577e7a08c13563f05cb31dae5f61af1))
* drop new worktree and pull main from the project actions menu ([807e164](https://github.com/centdix/webmux/commit/807e164db0f89c64790213d52be81cae14588c46))
* enforce 40-char max on auto-generated branch names ([#108](https://github.com/centdix/webmux/issues/108)) ([10311f6](https://github.com/centdix/webmux/commit/10311f65774fcdc6c43f9993cd17ba244eec2c6a))
* enforce minimum bun version (&gt;= 1.3.5) during webmux init ([867ea63](https://github.com/centdix/webmux/commit/867ea63c12fa637af5a75b63b709a294c8169f5a))
* expand init starter template ([#174](https://github.com/centdix/webmux/issues/174)) ([c4f022e](https://github.com/centdix/webmux/commit/c4f022e475607a3b389215e48582ed60e98fc585))
* expose worktree id in snapshots and key sidebar rows by it ([9b39851](https://github.com/centdix/webmux/commit/9b39851f3bf073f4dd333b583c4ebe9ea339f610))
* extract StartupEnvFields component ([#66](https://github.com/centdix/webmux/issues/66)) ([6a2206d](https://github.com/centdix/webmux/commit/6a2206d53183bcf5f307bb3d919aa6484caef55f))
* fetch and display GitHub PR inline review comments ([#55](https://github.com/centdix/webmux/issues/55)) ([da5a9b2](https://github.com/centdix/webmux/commit/da5a9b2db3fcb62ab8eee105d5d091faa0522388))
* generate .workmux.yaml with env-aware pane setup in init ([3cc608d](https://github.com/centdix/webmux/commit/3cc608db4c4d19fbfc8e4307d35da0b602643094))
* give each worktree being created its final id from the start ([2278355](https://github.com/centdix/webmux/commit/22783553a4519d848385076cd6b7d54a08793667))
* give every agent the webmux port instructions ([da12b8a](https://github.com/centdix/webmux/commit/da12b8ab6f9dee4fcf5ebfed4676c8170f4cc152))
* give every agent the webmux port instructions ([7ae3129](https://github.com/centdix/webmux/commit/7ae3129571b32063d9d14d66c7ee0c6520110855))
* group pr ci and comment badges ([#132](https://github.com/centdix/webmux/issues/132)) ([f173bbf](https://github.com/centdix/webmux/commit/f173bbf2148f9b365ce348ccf9d8b8e141068102))
* improve auto-name error reporting and speed ([3c8c984](https://github.com/centdix/webmux/commit/3c8c984717f4f6826bb9f1fed92b5f08cd043333))
* improve auto-name error reporting and speed ([3c8c984](https://github.com/centdix/webmux/commit/3c8c984717f4f6826bb9f1fed92b5f08cd043333))
* improve auto-name error reporting and speed ([b6b51d2](https://github.com/centdix/webmux/commit/b6b51d2cad6a08c17e5b856e5f654f28d2cec7af))
* improve codex web chat feedback ([#258](https://github.com/centdix/webmux/issues/258)) ([8adbdef](https://github.com/centdix/webmux/commit/8adbdef5019cdeccfad55f8dab51661a4af7691c))
* inject .env.local into worktree runtime environment ([#86](https://github.com/centdix/webmux/issues/86)) ([4d25f95](https://github.com/centdix/webmux/commit/4d25f95d98fd6cc3d12ab525f733c8e87ee459c4))
* inject tmux pane context into agent prompts ([#6](https://github.com/centdix/webmux/issues/6)) ([ddce102](https://github.com/centdix/webmux/commit/ddce10295a86568f2bd435153864e16ce1163f29))
* let agents create panes and address panes by stable label ([#9](https://github.com/centdix/webmux/issues/9)) ([ddade5f](https://github.com/centdix/webmux/commit/ddade5f78fcb726b537e1741fbde2c65307ac158))
* let agents register dev-server ports with webmux port ([1787e9a](https://github.com/centdix/webmux/commit/1787e9aec46e6d7973448c52c2fc4234d9c1662b))
* let webmux service run anywhere and add non-interactive install ([#282](https://github.com/centdix/webmux/issues/282)) ([4013397](https://github.com/centdix/webmux/commit/40133971ea3dce9d85ceb86c35d3d6a1074a3342))
* link a PR to its worktree as soon as the agent opens it ([329f415](https://github.com/centdix/webmux/commit/329f4151835bde1672d3e9c91d1b8d858591128a))
* link a PR to its worktree as soon as the agent opens it ([e68f333](https://github.com/centdix/webmux/commit/e68f333a522d5a470e950274dbc72079d94b2a32))
* list every project's worktrees in one sidebar scroll ([7257f35](https://github.com/centdix/webmux/commit/7257f35435d8e188f5e8b83d6c5b392f56df6152))
* list worktrees being created before open ones ([9c30da5](https://github.com/centdix/webmux/commit/9c30da57370377314e8868fece28384003129baa))
* load global config env from ~/.config/webmux/.env ([#295](https://github.com/centdix/webmux/issues/295)) ([d62612e](https://github.com/centdix/webmux/commit/d62612e71e12c00664d3463d91f51f0acc9bf2c9))
* make favorite star an always-visible toggle next to the row menu ([e0ac2fa](https://github.com/centdix/webmux/commit/e0ac2fac14673e3d77581098f06c4c8a8afd019a))
* make favorite star an always-visible toggle next to the row menu ([e8775a1](https://github.com/centdix/webmux/commit/e8775a1e713f08164339c593cf02191f87aeb646))
* make project headers sticky and show collapsed projects' agent statuses ([1a62890](https://github.com/centdix/webmux/commit/1a628902bb3a1b8d14e525ea799ccec2273c4c6d))
* make the open-in-editor IDE configurable ([#11](https://github.com/centdix/webmux/issues/11)) ([414ecfa](https://github.com/centdix/webmux/commit/414ecfac5926266df701aba8c3c9b85310384e44))
* manage custom agents in a global settings section ([e1e5c5d](https://github.com/centdix/webmux/commit/e1e5c5d0443afa749e179227d35ae54b733e1d8a))
* mention webmux port --keep in the agent port prompt ([7cf0c85](https://github.com/centdix/webmux/commit/7cf0c85a20ae7d71224b0bd4326b63ead85ac626))
* merge every project's notifications into a hub stream ([fd46ced](https://github.com/centdix/webmux/commit/fd46ced42ef3526bf1a73e3d7533d79407ef6104))
* migrate site docs to sveltekit ([#113](https://github.com/centdix/webmux/issues/113)) ([9b53372](https://github.com/centdix/webmux/commit/9b53372bb69a628c999c231f5180652589228291))
* name a sidebar row by its creation phase while it is created ([40ed644](https://github.com/centdix/webmux/commit/40ed644c8633c059c194b72e5e89518750552a5b))
* name a sidebar row by its creation phase while it is created ([b9cb556](https://github.com/centdix/webmux/commit/b9cb5567e58cd8f9e54edaf3ea63d8e115209c6c))
* notify changelog to discord on release ([365d73f](https://github.com/centdix/webmux/commit/365d73f1e650db7720d43dad59e78efec20a12dd))
* open pr when clicking a pr notification in the bell dropdown ([3dc3ded](https://github.com/centdix/webmux/commit/3dc3dedca29533ca7cd623506f3cbe39d0f1f598))
* order worktree list by session and pr state ([#289](https://github.com/centdix/webmux/issues/289)) ([44bd900](https://github.com/centdix/webmux/commit/44bd900efa85dae03cc0c3abd3c268cab2639b55))
* periodically save open sessions and add webmux restore ([a96f16d](https://github.com/centdix/webmux/commit/a96f16d70bbc5cb700a015a578e9a6865d0adcee))
* periodically save open sessions and add webmux restore ([0b41b19](https://github.com/centdix/webmux/commit/0b41b199a911cfc60245305d4b0fd8f1ee13b2c4))
* persist last selected worktree ([#135](https://github.com/centdix/webmux/issues/135)) ([62d82b9](https://github.com/centdix/webmux/commit/62d82b9a367d787a5614beaf95ab42d8b7d87ea5))
* polish Linear issue title and detect duplicates on --linear &lt;TEAM&gt; ([d2538d8](https://github.com/centdix/webmux/commit/d2538d80632a79fad27146c6f472c19579d746f9))
* polish Linear issue title and detect duplicates on --linear &lt;TEAM&gt; ([88f0af6](https://github.com/centdix/webmux/commit/88f0af6e681843f95eda688ad2368e013822a02c))
* poll PRs per project by dashboard focus: 10s focused, 60s visible, off idle ([53492f5](https://github.com/centdix/webmux/commit/53492f5f998772a098a063c893d9aa0d8851b7ad))
* post Linear comment when auto-create picks up an issue ([9c0bc35](https://github.com/centdix/webmux/commit/9c0bc35a51011bc56d2a8d41451d12f7a43fa358))
* post Linear comment when auto-create picks up an issue ([6d91151](https://github.com/centdix/webmux/commit/6d91151f51ba0fae724dde85dacdc13de7e9f556))
* prune only closed worktrees instead of all ([0fa2da6](https://github.com/centdix/webmux/commit/0fa2da67d05a705820a38643cb71f3a72cad2063))
* prune only closed worktrees instead of all ([164e7fc](https://github.com/centdix/webmux/commit/164e7fcbc1a699a94dace10b0d095f8896c497e1))
* rate-limit mitigation for GitHub API calls ([#69](https://github.com/centdix/webmux/issues/69)) ([efb4b4a](https://github.com/centdix/webmux/commit/efb4b4a46154842e6ef5e13320f08710d2f76707))
* redesign header with per-repo rows and linked repo cursor button ([#104](https://github.com/centdix/webmux/issues/104)) ([40e2256](https://github.com/centdix/webmux/commit/40e225643eed3f99b9f9ab497e344b9f5728108a))
* redirect /&lt;prefix&gt; across symmetric webmux instances ([#241](https://github.com/centdix/webmux/issues/241)) ([ad0b1dc](https://github.com/centdix/webmux/commit/ad0b1dcc0cde11fb12910fdbe6c0497f769f8c22))
* redirect old /&lt;project&gt; bookmarks to the project's location hash ([b84098b](https://github.com/centdix/webmux/commit/b84098bd06a3bd64617c15ac03ff81000f931bbe))
* release ports on worktree removal and add webmux port --keep ([84c5a28](https://github.com/centdix/webmux/commit/84c5a28b3e5b99d5107792344675d3ea01f775c6))
* release ports on worktree removal and add webmux port --keep ([e8e482e](https://github.com/centdix/webmux/commit/e8e482e7bc768bf506a16b017ac91e4f65c91d81))
* remove merge button and cmd+m shortcut from ui ([8b700d8](https://github.com/centdix/webmux/commit/8b700d80ec75fc4019dad261359a4ff46c822c09))
* render AskUserQuestion tool as a clickable web-chat card ([#276](https://github.com/centdix/webmux/issues/276)) ([4b7a659](https://github.com/centdix/webmux/commit/4b7a659534600bd4fc657017c7c58a5ca7da7393))
* render checkbox for boolean startupEnvs, omit unchecked from env ([e274b3b](https://github.com/centdix/webmux/commit/e274b3bc472e60748bd0d389aa08b2230e8918ac))
* replace the all-projects sidebar scroll with a project rail and the chosen project's list ([d2b92b9](https://github.com/centdix/webmux/commit/d2b92b948cd09c3a6cb0ac10bc740ae56a7ec6b8))
* replace the sidebar with a project rail and one project's list ([042272c](https://github.com/centdix/webmux/commit/042272c09ea4aae476b9b6b566b4f7b6d18238e6))
* report the focused project with every dashboard worktree poll ([f42b2cf](https://github.com/centdix/webmux/commit/f42b2cf710c2db3c711b793115037c2753cd88bc))
* reserve hub route segments as project prefixes ([b97e89f](https://github.com/centdix/webmux/commit/b97e89f07d6919f3b6baccfc9c1a98a765ceca56))
* resizable worktree list sidebar panel ([#153](https://github.com/centdix/webmux/issues/153)) ([bf7c4ba](https://github.com/centdix/webmux/commit/bf7c4ba379a5293b62c58e2e988a1cfe3c36ad53))
* reuse toast component for ui feedback ([#207](https://github.com/centdix/webmux/issues/207)) ([0c15532](https://github.com/centdix/webmux/commit/0c15532e82d5322441fd5a8fa25675b3a1bf7392))
* run docker sandboxes on host network with webmux cli mounted ([ddf22a9](https://github.com/centdix/webmux/commit/ddf22a97fd490a4e276309b7c23e8846f1206a2c))
* run docker sandboxes on host network with webmux cli mounted ([9891d7d](https://github.com/centdix/webmux/commit/9891d7d6767cf9e351d12c5cbc983516ec790077))
* scope linear watcher per team and pick ticket team in UI ([#240](https://github.com/centdix/webmux/issues/240)) ([729e51b](https://github.com/centdix/webmux/commit/729e51b1cca507ab662e34f4e3956ec2b2166846))
* select the worktree named by the location hash when it changes ([1a24c01](https://github.com/centdix/webmux/commit/1a24c0177bc7ac30d065050d5523b6e05c9792a4))
* send SSE keepalive pings on the hub notification stream ([34270ad](https://github.com/centdix/webmux/commit/34270ad444bdcc0bb8caa063bb16afc6438aafae))
* serve all projects from one webmux dashboard on one port ([#271](https://github.com/centdix/webmux/issues/271)) ([034b460](https://github.com/centdix/webmux/commit/034b46055dc0f8448e3f7ac579e3b3e8889c0854))
* serve the app only at the root path ([e646ccc](https://github.com/centdix/webmux/commit/e646ccc536d4f5c2e310ad705b85edee21ae0a55))
* set up a project on add (scaffold + analyze with Claude), observably ([#278](https://github.com/centdix/webmux/issues/278)) ([b6411da](https://github.com/centdix/webmux/commit/b6411dae3403ab785007e440807d8d1a5c014693))
* share api contract across backend and frontend ([#213](https://github.com/centdix/webmux/issues/213)) ([47b26be](https://github.com/centdix/webmux/commit/47b26be5aec24716144278c836ffb3020d33a4af))
* show a naming_branch row as soon as a worktree create starts ([60b7b64](https://github.com/centdix/webmux/commit/60b7b64489755fd7fe41b215b866eb823ef65215))
* show a row for each worktree while its branch is being named ([9983a97](https://github.com/centdix/webmux/commit/9983a972148c66b32c04a8592ad6c2ce0f0bf388))
* show creating indicator in worktree list instead of blocking dialog ([#99](https://github.com/centdix/webmux/issues/99)) ([c388ee5](https://github.com/centdix/webmux/commit/c388ee562271b764cd058674b2b3bd5c0199bf9c))
* show creating worktree at top of list instead of bottom ([#103](https://github.com/centdix/webmux/issues/103)) ([e3a8440](https://github.com/centdix/webmux/commit/e3a8440264be54eb7ee6532d509307530e909916))
* show creation status logs in CLI add command ([#186](https://github.com/centdix/webmux/issues/186)) ([2d8a82f](https://github.com/centdix/webmux/commit/2d8a82f5e7a75f13b0985b8802927e73bd8eb1e7))
* show draft vs ready-for-review state on PR badges ([#305](https://github.com/centdix/webmux/issues/305)) ([d8c9d5f](https://github.com/centdix/webmux/commit/d8c9d5fa2fc061bff1425de2910d784a48961f1e))
* show every row's PR as a state-only icon ([2702215](https://github.com/centdix/webmux/commit/2702215a7893c1b61e1f80414df04d14f3717fd6))
* show externally-created worktrees in UI ([#62](https://github.com/centdix/webmux/issues/62)) ([5b3c8c2](https://github.com/centdix/webmux/commit/5b3c8c2ad72bf7d48bd8b7861c3512e2317c9a51))
* show git status in diff dialog ([#192](https://github.com/centdix/webmux/issues/192)) ([4d587f5](https://github.com/centdix/webmux/commit/4d587f56d0ea3e01a386fd06467f5c5c8c90e9b7))
* show linked repos inline in sidebar ([#182](https://github.com/centdix/webmux/issues/182)) ([fa1cb0f](https://github.com/centdix/webmux/commit/fa1cb0f014491c513c642819834f5278846574a8))
* show preview panel for closed worktrees instead of auto-opening ([#144](https://github.com/centdix/webmux/issues/144)) ([9132c95](https://github.com/centdix/webmux/commit/9132c95be6c92ebf15128554adb46b03cb5dda37))
* split settings into global options and one section per project ([98e8d89](https://github.com/centdix/webmux/commit/98e8d89c0f5c44f2a47b71c25f319483c25876fe))
* stop generating and advertising the services config ([502c3aa](https://github.com/centdix/webmux/commit/502c3aaf88e25d62103940e6d48309be484fbd4c))
* stop generating services in webmux init, use webmux port ([89129c7](https://github.com/centdix/webmux/commit/89129c756b72c04e97b27c9dd9faa3796fea7dc1))
* store custom agents globally in ~/.config/webmux/config.yaml ([cff9c8b](https://github.com/centdix/webmux/commit/cff9c8b787e6d16ab60594421b1e85117829399b))
* store custom agents globally in ~/.config/webmux/config.yaml ([873088c](https://github.com/centdix/webmux/commit/873088cf07b4f47228394c3e3b91d970ae5ff6ea))
* stream codex chat and refresh stale terminals ([#254](https://github.com/centdix/webmux/issues/254)) ([6fcd2c6](https://github.com/centdix/webmux/commit/6fcd2c6ec06458ef76fb138db325411a56565971))
* support `--agent=both` in the CLI ([#200](https://github.com/centdix/webmux/issues/200)) ([1a8b32b](https://github.com/centdix/webmux/commit/1a8b32b34cd5454b9439b1a6c2b70062cb4812a6))
* support Shift+Enter for newline in terminal via tmux send-keys ([#63](https://github.com/centdix/webmux/issues/63)) ([cf87fbe](https://github.com/centdix/webmux/commit/cf87fbe50455039bcc6505393e75e5723afd55d0))
* surface backend worktree creation progress ([#112](https://github.com/centdix/webmux/issues/112)) ([c193879](https://github.com/centdix/webmux/commit/c193879fcfa9da350379c412a53f62d6d7ca968a))
* switch a worktree to another profile after creation ([2c320ef](https://github.com/centdix/webmux/commit/2c320ef08e133cc23523f27cc5049ce2fc704d68))
* switch a worktree to another profile after creation ([bc3b714](https://github.com/centdix/webmux/commit/bc3b71427e7f3dd6b31bb1c8adb591564d8ae89b))
* switch projects in memory with a #project/branch hash ([169b9a3](https://github.com/centdix/webmux/commit/169b9a3976aaffbf1d3fa00c9c72493296e2b85f))
* terminal drag-and-drop image upload ([#147](https://github.com/centdix/webmux/issues/147)) ([3c78567](https://github.com/centdix/webmux/commit/3c7856744e36a627b02f39bbfa9c197a6dadae6f))
* **terminal:** hide the tmux status bar in the dashboard terminal ([aa02684](https://github.com/centdix/webmux/commit/aa02684cb6028434979fd884619255127aa004da))
* **terminal:** hide the tmux status bar in the dashboard terminal ([ca04b6a](https://github.com/centdix/webmux/commit/ca04b6ac6f18a9cbdde9962ebcd1fa8215ada86e))
* tie the Linear panel to the selected worktree's project ([5ffde69](https://github.com/centdix/webmux/commit/5ffde6967ee3ed4b77da79ff58ce4f09faad97e2))
* uncomment services and add npm install in init templates ([2943df2](https://github.com/centdix/webmux/commit/2943df27f3f360cdc339e3ea8753048e51c4c7da))
* use claude/codex CLI for auto-name instead of direct API calls ([#94](https://github.com/centdix/webmux/issues/94)) ([5d313e8](https://github.com/centdix/webmux/commit/5d313e81d08758cc940fc3e6229b3ecbd9ce0982))
* webmux oneshot + Linear round-trip, server-driven watcher ([#238](https://github.com/centdix/webmux/issues/238)) ([d43ad25](https://github.com/centdix/webmux/commit/d43ad25ef95524553ce532c2dd2506a38134ebe4))


### Bug Fixes

* add -- before prompt arg to prevent dash-prefixed prompts being parsed as CLI flags ([#190](https://github.com/centdix/webmux/issues/190)) ([3b8e926](https://github.com/centdix/webmux/commit/3b8e92658ebcd5562d1728b015c3469d20b99d86))
* add auto-name timeout fallback ([#205](https://github.com/centdix/webmux/issues/205)) ([066375a](https://github.com/centdix/webmux/commit/066375a274af5482b423637fa6f40009a8e8417b))
* add missing static/.assetsignore for cloudflare pages build ([dcf51ea](https://github.com/centdix/webmux/commit/dcf51ea62eb5ae449722c1218ffd885e30c90749))
* add wrangler.toml for cloudflare pages deploy ([be35397](https://github.com/centdix/webmux/commit/be35397fb5b9e7ab9ba4e23a1a2f7ca7141d99c2))
* address review nits on Linear title polish + dedup ([70bd58c](https://github.com/centdix/webmux/commit/70bd58c5f4569ba561d34a6f8ae04e7ba497e068))
* **agents:** stop a failing chat-mode claude run from crashing the server ([493b707](https://github.com/centdix/webmux/commit/493b7078e65164e80dc19d72c6f3dc7c8a2a6038))
* **agents:** stop a failing chat-mode claude run from crashing the server ([84e6536](https://github.com/centdix/webmux/commit/84e65366fce5304ce81bf8d0e0e8718f5811e2cd))
* append branch name to linked repo cursor URL path ([#107](https://github.com/centdix/webmux/issues/107)) ([64a877a](https://github.com/centdix/webmux/commit/64a877af585de98f5c8abb0b13e4725cfcd97d68))
* **auto-remove:** sweep merged worktrees headlessly ([#291](https://github.com/centdix/webmux/issues/291)) ([70c51e4](https://github.com/centdix/webmux/commit/70c51e43e75b7208a7a9040bbf98762d6d22aa4a))
* avoid reopening removing worktrees ([cabbeac](https://github.com/centdix/webmux/commit/cabbeac3df2af5d59b45d42b26efbee05cdcbf58))
* cancel another project's pending create when the hash switches project ([9add0a2](https://github.com/centdix/webmux/commit/9add0a29bd1d66f80345139c4ddb25be08f4e009))
* carry the notification on its toast so dismiss always routes by project ([bfc3f76](https://github.com/centdix/webmux/commit/bfc3f76a9c7cc79e09ae83d9c63001b9c9f37318))
* check for systemctl/launchctl before managing services ([61c9819](https://github.com/centdix/webmux/commit/61c9819315202030b21d87f5e273dbdcbd2e39fd))
* claim Linear auto-create issues once across projects and keep failures per project ([712a082](https://github.com/centdix/webmux/commit/712a082805d863ba1015fcd927d4cfaefaea1aa9))
* clean up orphaned tmux windows on worktree list poll ([#60](https://github.com/centdix/webmux/issues/60)) ([c399d02](https://github.com/centdix/webmux/commit/c399d02c5c0881fe8ef3e72171f3077f96fee485))
* clickable pr notifications and remove merge button from ui ([9c68f72](https://github.com/centdix/webmux/commit/9c68f723904679ae1d78bbda7a4eb4a48c7ec9dc))
* **cli:** ignore inherited PORT inside worktree shells ([11350c6](https://github.com/centdix/webmux/commit/11350c6b7324e70cfc17cc0e213a3202716c090d))
* **cli:** ignore inherited PORT inside worktree shells ([f057e65](https://github.com/centdix/webmux/commit/f057e65dbb2b06dd9fdd2713ba7fde3f59d8cf70))
* close popup menus on any outside click and raise an open menu above the next sticky header ([5fcd8e7](https://github.com/centdix/webmux/commit/5fcd8e745a87650c3ea63d4330d872479f3c121a))
* collapse newlines in agent command quoteShell to prevent tmux send-keys splitting ([#189](https://github.com/centdix/webmux/issues/189)) ([fdec1ac](https://github.com/centdix/webmux/commit/fdec1acba9134dde25bb1b202aef76fe5eb0667d))
* comment out services section in wmdev template ([3967301](https://github.com/centdix/webmux/commit/3967301fd4b6c2fe8b8b069b7e1b19991a86fdcb))
* count every hub worktree poll as dashboard activity and ignore empty or unknown focus ([d3c9c9c](https://github.com/centdix/webmux/commit/d3c9c9c55c632b78c4cd24e04a3f73f14cc7b02a))
* create from Linear issue details in the project they were opened from ([ae660e9](https://github.com/centdix/webmux/commit/ae660e9ab95ed202553d31da4db35eb152d9a428))
* cut GitHub API polling with per-project PR caches and backoff ([ac29524](https://github.com/centdix/webmux/commit/ac2952460ba49c6fbd4262014660395e45d5ec24))
* decouple linear auto-create from dashboard ([#235](https://github.com/centdix/webmux/issues/235)) ([14fe259](https://github.com/centdix/webmux/commit/14fe2598759febce1e35c09be18efedae4fc29bf))
* defer .env.local sourcing in pane commands to avoid port race condition ([#54](https://github.com/centdix/webmux/issues/54)) ([d4e077f](https://github.com/centdix/webmux/commit/d4e077f755d404fa825da5092cb6645bd6848ff6))
* delay codex terminal prompt submission ([#226](https://github.com/centdix/webmux/issues/226)) ([6964d29](https://github.com/centdix/webmux/commit/6964d29bcbdd15d4990df83f582dbbb035129ecb))
* do not cache Linear assigned issues fetched before an issue was created ([f16ccc8](https://github.com/centdix/webmux/commit/f16ccc8b58bdbd6e44b370bbb7553bfaa9f2df31))
* don't close dialog when drag-selecting text out of modal ([dc41a31](https://github.com/centdix/webmux/commit/dc41a313945a768b1e0743224132085d1e65759b))
* don't close dialog when drag-selecting text out of modal ([92a611a](https://github.com/centdix/webmux/commit/92a611ad7d0987c0b42624a93686a480cd77cd62))
* drop a create's pending auto-select once the user moves to another project ([fa136ab](https://github.com/centdix/webmux/commit/fa136ab33b7468467164921300e7fbd879f72da0))
* drop a project removed mid-request from the hub worktree listing ([f6f20d0](https://github.com/centdix/webmux/commit/f6f20d088c5752dee39592fd3201cd5579471a2c))
* drop a project's hub source on dispose, not on stopLight ([23e4743](https://github.com/centdix/webmux/commit/23e4743b8b4a8e704a09218e25c719f84a68bda3))
* drop a removed project from the sidebar and its caches right away ([ee2beac](https://github.com/centdix/webmux/commit/ee2beac84b17363fd11a3adfd8759d6ccdbc3a0c))
* drop a row's context menu once its row leaves the list ([8d763d2](https://github.com/centdix/webmux/commit/8d763d2dded9bd283d304983784d550193851710))
* drop an in-flight project config load when the cached value is updated ([c18eb76](https://github.com/centdix/webmux/commit/c18eb76db44c18a6bf4fb832e6afdd61daf362cb))
* drop the Cmd+K hint from the new worktree button on mobile ([aab0bf9](https://github.com/centdix/webmux/commit/aab0bf9746b9e7c3fe3ec68ffea44e2f09c53b2e))
* escape single quotes in .env.local values for bash sourcing ([#68](https://github.com/centdix/webmux/issues/68)) ([e7022d7](https://github.com/centdix/webmux/commit/e7022d7842ca11e68478679b6412615cd93465df))
* extend auto-name timeout fallback ([#223](https://github.com/centdix/webmux/issues/223)) ([50875b1](https://github.com/centdix/webmux/commit/50875b11642be1002522cf21d8c838235a960127))
* fall back to python3 pty.spawn when script is not in PATH ([#166](https://github.com/centdix/webmux/issues/166)) ([8188e5a](https://github.com/centdix/webmux/commit/8188e5a0bbc569b2a75c5fbeaa72702d6ecc4002))
* filter ci logs to show only the selected check's job ([#145](https://github.com/centdix/webmux/issues/145)) ([1114094](https://github.com/centdix/webmux/commit/111409425701fd0ddefb59773e51e96fc80b57af))
* filter duplicate worktree entry while creating ([#105](https://github.com/centdix/webmux/issues/105)) ([c64f670](https://github.com/centdix/webmux/commit/c64f670021f8008bac08cadfe33bcca384dac829))
* force pane-base-index 0 on managed tmux sessions ([#98](https://github.com/centdix/webmux/issues/98)) ([f326134](https://github.com/centdix/webmux/commit/f326134abf4e26843d08ad87aea30628df2826b0))
* force remove worktrees from backend ([7e0f192](https://github.com/centdix/webmux/commit/7e0f192d47e6034f94933475be0e06294f5eb26a))
* forward old /&lt;project&gt; bookmark redirects from the Vite dev server ([2b49f46](https://github.com/centdix/webmux/commit/2b49f467a69c02b0112fa44fa9c95ab7b72b4ec9))
* git-exclude claude settings.local.json generated in worktrees ([bcc3bb6](https://github.com/centdix/webmux/commit/bcc3bb610d4dcd269ab05e2316175ebe4af0c740))
* git-exclude claude settings.local.json generated in worktrees ([a60b7dc](https://github.com/centdix/webmux/commit/a60b7dc110849756f3286a1d1dc29dbcea272cfb))
* give the empty-projects screen the surface background ([df26fa5](https://github.com/centdix/webmux/commit/df26fa52a82343a437af05fdbab444ab30e6e80c))
* handle codex assistant message fields ([#256](https://github.com/centdix/webmux/issues/256)) ([e834209](https://github.com/centdix/webmux/commit/e8342096d9d79a9582034ca8674971fc1f8b7471))
* handle missing direnv binary in lifecycle hook runner ([#89](https://github.com/centdix/webmux/issues/89)) ([d4f10d4](https://github.com/centdix/webmux/commit/d4f10d4db8c7eab761dad562ba9385f774ebf287))
* handle selections in collapsed projects and wait for the create dialog's project config ([ac68199](https://github.com/centdix/webmux/commit/ac681991c6f5298a56de4beceb825a31d8aa4771))
* harden backend worktree removal ([a79e171](https://github.com/centdix/webmux/commit/a79e1717d4fe3c2e7aec0160fcadcdbecc927c1d))
* harden tmux closed-session handling ([#128](https://github.com/centdix/webmux/issues/128)) ([a9b941f](https://github.com/centdix/webmux/commit/a9b941f385146cc0ca15df246553ee713ccf0289))
* harden webmux list --all-projects output and exit code ([af84435](https://github.com/centdix/webmux/commit/af84435634f60370cdc5897b678cbcc42757537f))
* honor configured service URLs ([5cb56d1](https://github.com/centdix/webmux/commit/5cb56d1f0864ceebb8eb15dbbf75c1c3957ef18e))
* honor configured service URLs ([02a8e75](https://github.com/centdix/webmux/commit/02a8e75611abdb0305e877efe8fb618b24cb2b85))
* include remote branches in worktree branch selector ([#171](https://github.com/centdix/webmux/issues/171)) ([fe2948a](https://github.com/centdix/webmux/commit/fe2948ad59a5d42270463d4c02b3e059845a093b))
* isolate development servers from production ([#7](https://github.com/centdix/webmux/issues/7)) ([98c5d14](https://github.com/centdix/webmux/commit/98c5d141917370db16dc05bfa327de2a917d29d3))
* isolate pane base index from user tmux config ([#115](https://github.com/centdix/webmux/issues/115)) ([5308220](https://github.com/centdix/webmux/commit/53082200e72ae1d8c2f84a653b26e9b4d59869ff))
* isolate terminal sessions and serialize sync ([#138](https://github.com/centdix/webmux/issues/138)) ([31f4162](https://github.com/centdix/webmux/commit/31f4162683da14299eb29b3cb670ad2ccf0de6b3))
* keep a cancelled project pull from touching the next pull's dialog ([37e8fc3](https://github.com/centdix/webmux/commit/37e8fc3793e8a2288c4fa8027c9f8f4a42f243ac))
* keep auto-dismissed notifications in the bell and skip seen ones on stream replay ([a996d47](https://github.com/centdix/webmux/commit/a996d47c799d4441c62380ef84382ce33f2b8ad9))
* keep claude chat stream open across turns to preserve message order ([#274](https://github.com/centdix/webmux/issues/274)) ([3d35c34](https://github.com/centdix/webmux/commit/3d35c342f9acd26355e8a67a162ac687259e3c3b))
* keep dashboard pr sync active ([#219](https://github.com/centdix/webmux/issues/219)) ([79371cb](https://github.com/centdix/webmux/commit/79371cb5fa337c53d0e91bbbef075b0cf2c87867))
* keep launch project .env secrets out of tmux global env ([#285](https://github.com/centdix/webmux/issues/285)) ([153ce85](https://github.com/centdix/webmux/commit/153ce85bfe7c99edd967d5cb75ef67b03fe7a78b))
* keep rail avatar tints distinct in themes with a purple accent ([5f24f52](https://github.com/centdix/webmux/commit/5f24f52292be586c429cce1b8e754784beaaeae2))
* keep selected worktree on create ([#136](https://github.com/centdix/webmux/issues/136)) ([224c3a6](https://github.com/centdix/webmux/commit/224c3a60e7a4fa16841f35c7a04599a32c3a7e72))
* keep the newest project cache load when an older one resolves late ([0892391](https://github.com/centdix/webmux/commit/089239125595036eb31d58cf32a8cd2b6bd47eee))
* keep tmux window on in-worktree branch rename ([d451bd7](https://github.com/centdix/webmux/commit/d451bd7e5065f50174f1db725c6f4358b502c35d))
* keep tmux window on in-worktree branch rename ([e320cb4](https://github.com/centdix/webmux/commit/e320cb4ae6ae46dcb32fdd1c94420fe334db1404))
* keep webmux's own PORT out of panes, agents and hooks ([7ad75b7](https://github.com/centdix/webmux/commit/7ad75b783b881282065b329054a3dd963f97949a))
* leave Cmd+Shift+Up/Down to text fields outside the terminal ([7398c25](https://github.com/centdix/webmux/commit/7398c25b5070b58c245bea319ebcf0d7fddd18f7))
* **linear:** don't treat a linked github issue as a PR ([#287](https://github.com/centdix/webmux/issues/287)) ([b8600a0](https://github.com/centdix/webmux/commit/b8600a0091034edab3037472487b3cedf0c493fd))
* live web-chat updates for terminal-initiated Claude turns ([#275](https://github.com/centdix/webmux/issues/275)) ([a55f06c](https://github.com/centdix/webmux/commit/a55f06cedfa541a669857ef0b58bdb5b2ba358d1))
* lock diff viewer to dark colors ([#220](https://github.com/centdix/webmux/issues/220)) ([efdf13f](https://github.com/centdix/webmux/commit/efdf13fda1875e7bc27c9dfd2324e3a58ef97942))
* make context menus keyboard navigable and toggle closed from their trigger ([c9b6190](https://github.com/centdix/webmux/commit/c9b61902bc678a26a719a38765e3c0319a335b20))
* make linear badge static in worktree list ([#161](https://github.com/centdix/webmux/issues/161)) ([000ad83](https://github.com/centdix/webmux/commit/000ad83693158b36b51419a5712949118fafbbda))
* make pr links in notification toasts clickable ([b30f77e](https://github.com/centdix/webmux/commit/b30f77eb8069c5068e3d2085ae4be7fb4768933a))
* make project rail initials unique and spread avatar tints ([6e5a16d](https://github.com/centdix/webmux/commit/6e5a16d5b67591064ea958a639d158fef46c29e9))
* match an in-flight creation to its worktree by path, pair ids per agent ([68dfc10](https://github.com/centdix/webmux/commit/68dfc101d8e91cbb2589fc2709007267aee3b0a2))
* migrate the unscoped legacy favorites into the current project ([8adf0d5](https://github.com/centdix/webmux/commit/8adf0d571157d62c32ab2f32b61dc84ad22039e3))
* migrate the unscoped worktree selection into the project key ([83b6a8f](https://github.com/centdix/webmux/commit/83b6a8f2a74b6b56820bdb42041c14be495b4c8d))
* move api-contract to devDependencies to unbreak global install ([#225](https://github.com/centdix/webmux/issues/225)) ([73a6174](https://github.com/centdix/webmux/commit/73a6174992a4aa2f77fe75443bf62ca868be129b))
* move named agents to creating rows and tidy pending row types ([bf19290](https://github.com/centdix/webmux/commit/bf19290d2fa81984d06b648b36a16a50ee1f095f))
* move worktree badges below names ([#233](https://github.com/centdix/webmux/issues/233)) ([63130ac](https://github.com/centdix/webmux/commit/63130ac1955dad21172d046dd8b91e97929cb206))
* multi-project follow-ups for the CLI registry, rail avatars and touch ([264f6f4](https://github.com/centdix/webmux/commit/264f6f43c76dec72082fd9970406e96325369809))
* name each project settings section's controls after its project ([e0b0aab](https://github.com/centdix/webmux/commit/e0b0aab415dbc000ac60025d7c3eec202b8197f6))
* name rail projects with their badge state for screen readers ([c9dddee](https://github.com/centdix/webmux/commit/c9dddee94bccc69eedf235a5f9c9e140396ab268))
* name the right worktree in the webmux port conflict error ([d7b44a5](https://github.com/centdix/webmux/commit/d7b44a513d78704c9fbc8716170df51dc93b0c33))
* parse serve flags after subcommand ([#95](https://github.com/centdix/webmux/issues/95)) ([a09918f](https://github.com/centdix/webmux/commit/a09918fcb2d65094a2db9ccc3b2aa56ac0e24196))
* persist startupEnvs and checkbox state in save as default ([#109](https://github.com/centdix/webmux/issues/109)) ([7b26564](https://github.com/centdix/webmux/commit/7b26564d684b42bbd4d225103bb5eea771bc46ac))
* preserve init template config comments ([#178](https://github.com/centdix/webmux/issues/178)) ([c1c325d](https://github.com/centdix/webmux/commit/c1c325dd20bbbb4129110ea9d939dbe83c29cf63))
* prevent Safari from closing branch selector before selection ([#188](https://github.com/centdix/webmux/issues/188)) ([74bc422](https://github.com/centdix/webmux/commit/74bc422bea4e339325d7720dc8c3bd1a161a833b))
* probe both IPv4 and IPv6 in service port health check ([#87](https://github.com/centdix/webmux/issues/87)) ([62eb812](https://github.com/centdix/webmux/commit/62eb812d3d6b45be96fe5ac4b8b6f845e8551d5c))
* proxy per-project /&lt;prefix&gt;/api and /ws paths in vite dev ([5948448](https://github.com/centdix/webmux/commit/594844886bb0b7acd86c40543eed171b92fe7e50))
* **pr:** stop cancelled CI runs from masking the latest review status ([#298](https://github.com/centdix/webmux/issues/298)) ([9001d9f](https://github.com/centdix/webmux/commit/9001d9f92d94d151add9983dc32a7d1384fd3945))
* recognize Bun's connection-refused message in formatServerError ([a7d78f7](https://github.com/centdix/webmux/commit/a7d78f7d7ea32a9b195315812681949140f3f017))
* recognize Bun's connection-refused message in formatServerError ([3a67ffb](https://github.com/centdix/webmux/commit/3a67ffb12ef5185a09fa4efaf7d99785e4067c48))
* reconcile idle projects on a staleness window in hub worktree listing ([f914827](https://github.com/centdix/webmux/commit/f9148270702d9e3bac8cb824b700d07ae515bb64))
* reconnect terminal after idle disconnect ([#127](https://github.com/centdix/webmux/issues/127)) ([9f107d0](https://github.com/centdix/webmux/commit/9f107d071a5232eba1c903d80610b9d95ec431e6))
* refine agent chat ui ([#260](https://github.com/centdix/webmux/issues/260)) ([632c504](https://github.com/centdix/webmux/commit/632c504ef775e5758f9f830c1611f206d4921560))
* register zsh completion for webmux ([#102](https://github.com/centdix/webmux/issues/102)) ([195822d](https://github.com/centdix/webmux/commit/195822d7a1283e2bffecc646387ac4f4cb64a423))
* reload a project's config on entry and on polls once it is a minute old ([ab939a8](https://github.com/centdix/webmux/commit/ab939a888c477f3eaeee1f822e6ee21c17b9e04f))
* reload dotenv after post-create hook ([#111](https://github.com/centdix/webmux/issues/111)) ([5402897](https://github.com/centdix/webmux/commit/54028975c64214b0ac6462b7ff398fd843843ffa))
* reload loading projects and surface failed custom agent deletes ([611b030](https://github.com/centdix/webmux/commit/611b030ce0e802fcf51a0ea9e57f5e0fcf40c844))
* remove --max-tokens use ([e42e175](https://github.com/centdix/webmux/commit/e42e175fa97492b1e47f6a7144ebffb79c2710de))
* remove hardcoded fake-repo from linked repos ([#184](https://github.com/centdix/webmux/issues/184)) ([4859a80](https://github.com/centdix/webmux/commit/4859a80d34fabfd4881408f1526ba9a16db7265b))
* remove svelte build warnings ([#198](https://github.com/centdix/webmux/issues/198)) ([8c679bb](https://github.com/centdix/webmux/commit/8c679bbba7ca0f6499d0c3c82a8c24a645c19115))
* remove the temp global config file when a write fails ([48df96c](https://github.com/centdix/webmux/commit/48df96c30dbf8dc65aebc1a788afaf8a77ab053b))
* report a corrupt project registry in webmux list --all-projects ([a7c1842](https://github.com/centdix/webmux/commit/a7c184218a4a3992a72d584576abfd087fc5b7a8))
* report every project .env key so [#285](https://github.com/centdix/webmux/issues/285)'s tmux scrub actually runs ([c6c223d](https://github.com/centdix/webmux/commit/c6c223d95bdecfdc40f57b6ef3be369fe46784f9))
* report every project .env key so the tmux env scrub actually runs ([1222fee](https://github.com/centdix/webmux/commit/1222feeb32ca6da83c60ae8911ad850761e73e77))
* report the resolved working branch in oneshot pickup comments ([31c9f55](https://github.com/centdix/webmux/commit/31c9f5553daa8217453ffa83454004febae6982e))
* reset web-chat worktree status from owned claude -p run ([#273](https://github.com/centdix/webmux/issues/273)) ([5753794](https://github.com/centdix/webmux/commit/57537941e3eaada34c998894d233ab025aae2067))
* resolve detached HEAD breaking worktree tmux lookup during rebase ([e6354b0](https://github.com/centdix/webmux/commit/e6354b0a926d9c1eb8abd6263cdbc54a0dd0b6df))
* resolve relative linked repo dir and support array github config ([#106](https://github.com/centdix/webmux/issues/106)) ([43d80dd](https://github.com/centdix/webmux/commit/43d80dd4e7ceab83b0cd54be8f0c38303c11bc58))
* resolve remove from linked worktree ([#125](https://github.com/centdix/webmux/issues/125)) ([b0b1c70](https://github.com/centdix/webmux/commit/b0b1c70d4b41aa75abfee4ff5cafc8c36e2319df))
* restore agent status by prefixing the runtime control URL ([d168301](https://github.com/centdix/webmux/commit/d16830192fdcc5dfa81bff33df544f60bb136b25))
* restore agent status by prefixing the runtime control URL ([d7fba24](https://github.com/centdix/webmux/commit/d7fba241c00714d9d5e3cecd9e31c8c36d696001))
* restore claude hooks after post-create ([#114](https://github.com/centdix/webmux/issues/114)) ([8ac4528](https://github.com/centdix/webmux/commit/8ac4528635b06e861474375192efb74339a54f21))
* restore mobile agent pane scrolling ([#123](https://github.com/centdix/webmux/issues/123)) ([d62f062](https://github.com/centdix/webmux/commit/d62f0627c36ed25ecea8972ba57e34d0f8231c4b))
* resume agent sessions on reopen ([#116](https://github.com/centdix/webmux/issues/116)) ([6748292](https://github.com/centdix/webmux/commit/6748292f20c197804842ac9f9eccf6c4c38f6b3c))
* return JSON 404 for unmatched API paths instead of the SPA fallback ([3ace25f](https://github.com/centdix/webmux/commit/3ace25f9630be241266328b2705f68c4becb375c))
* revert \$teamId to ID! — Linear rejects String! in this filter ([18b3653](https://github.com/centdix/webmux/commit/18b36533a6782f882573f1d945404915d8882914))
* run postcreate hook before tmux startup ([4ad6a73](https://github.com/centdix/webmux/commit/4ad6a73f5fcb1dabc084073ca6b30897d97339aa))
* scope PR caches per project, batch stale PR refresh, back off on GitHub rate limits ([a287c5c](https://github.com/centdix/webmux/commit/a287c5c49c1cf8e6d8a7e7168ddfa08634e50680))
* scope stale terminal banner to terminal pane ([#255](https://github.com/centdix/webmux/issues/255)) ([e06682f](https://github.com/centdix/webmux/commit/e06682f2c5a73af7a248792ace42e2df7e84dfd9))
* send creation status logs to stdout instead of stderr ([4aab7fb](https://github.com/centdix/webmux/commit/4aab7fbb14270c2e0f92926c7629ee85f485518d))
* serialize custom agent changes and write the global config safely ([0fbe77e](https://github.com/centdix/webmux/commit/0fbe77ed96b9f26b94fbd5e2bb81d2c8be2c8829))
* serve /index.html without caching like / ([329ca56](https://github.com/centdix/webmux/commit/329ca561caad803e7c6d62d6fda194ddc87d0607))
* share Linear polling across projects and claim issues once ([af50578](https://github.com/centdix/webmux/commit/af50578e37d7e0bbac3906a05f7909fdec6254b0))
* share one Linear assigned-issues fetch across projects and scope processed issues per project ([695d4d6](https://github.com/centdix/webmux/commit/695d4d62936e1fb4a4651311100aceb911c4cb26))
* show a retryable error instead of the empty state when projects fail to load ([2f7c12b](https://github.com/centdix/webmux/commit/2f7c12b8c0e7998e292afc37d382fc81a089c204))
* show an error when a project settings toggle fails to save ([2a0ee70](https://github.com/centdix/webmux/commit/2a0ee709eb5f2ad9af7ee2d8560e383a0b22bfcb))
* show every row's actions button on mobile ([3c5dd76](https://github.com/centdix/webmux/commit/3c5dd76f3d029891c0c28334190e03023aec1d9a))
* show linear panel without api key ([#164](https://github.com/centdix/webmux/issues/164)) ([0c8965d](https://github.com/centdix/webmux/commit/0c8965d6d60f2c5ed7419a744dcf7d689691c669))
* show remote toggle when no branches match in selector ([#180](https://github.com/centdix/webmux/issues/180)) ([f767d3a](https://github.com/centdix/webmux/commit/f767d3af1d9196019f28f565c50265d076d88dfc))
* show the project name in the sidebar header while its config loads ([f025c9c](https://github.com/centdix/webmux/commit/f025c9c3017818fd912c02035d5e5b9713dda01c))
* show the worktree row menu button on every row on touch devices ([3f96ee0](https://github.com/centdix/webmux/commit/3f96ee09d476c88d405708e642746c030ae86a04))
* simplify worktree create loading state ([#110](https://github.com/centdix/webmux/issues/110)) ([2fc6722](https://github.com/centdix/webmux/commit/2fc67227f4c265cc264a06eca2fb5fe65836b318))
* single-quote PR_DATA in .env.local for shell safety ([#52](https://github.com/centdix/webmux/issues/52)) ([70056d4](https://github.com/centdix/webmux/commit/70056d4c24dfe34eab16067ad46c9a3a33ae9565))
* soften review comment prompt ([#194](https://github.com/centdix/webmux/issues/194)) ([53b952e](https://github.com/centdix/webmux/commit/53b952e7157fe9f2d860ac99bf80324e19215250))
* stabilize docker sandbox shell startup ([#209](https://github.com/centdix/webmux/issues/209)) ([da32507](https://github.com/centdix/webmux/commit/da32507c4c3643d1213b97a0a72669aec56997ff))
* stabilize terminal attachment after worktree creation ([354c327](https://github.com/centdix/webmux/commit/354c32707404c361c161d58ac872c873c0218fe5))
* stabilize terminal attachment after worktree creation ([cbadd57](https://github.com/centdix/webmux/commit/cbadd57c440a11f5ad20f763c036da03dcdbfcf7))
* start new worktrees from freshly fetched origin base ([d684f66](https://github.com/centdix/webmux/commit/d684f6698326a713d64d5e13a10b6a4a47f14a0e))
* start new worktrees from freshly fetched origin base ([604d585](https://github.com/centdix/webmux/commit/604d5854d7fd622fd5179bf9859aba5d78934f8f))
* stop polish from running the prompt as a task ([ccd87b7](https://github.com/centdix/webmux/commit/ccd87b73b928ec747c1afc315f37a268177693cc))
* stop terminal adapter tests from killing live dashboard tmux sessions ([c519f0a](https://github.com/centdix/webmux/commit/c519f0ab23da8b9d202f14e93b8496422f9654a8))
* stop terminal adapter tests from killing live dashboard tmux sessions ([0b27742](https://github.com/centdix/webmux/commit/0b277425066bb9c14c4ddff1963bcb398fc6cec1))
* survive stale git worktree registrations ([#236](https://github.com/centdix/webmux/issues/236)) ([cf72b1b](https://github.com/centdix/webmux/commit/cf72b1b5aca95941b8f08f74ce4beddd9cbe637b))
* switch to tmux window after webmux open ([#121](https://github.com/centdix/webmux/issues/121)) ([6f6d0fa](https://github.com/centdix/webmux/commit/6f6d0faa9023ebc672977190726c43bb353fb254))
* tag browser notifications with the shared notification key ([ac18ec3](https://github.com/centdix/webmux/commit/ac18ec358c9f7d289742df5b748d2dc3b5bd5bc6))
* target the live server port for server-backed CLI commands ([3b0a82f](https://github.com/centdix/webmux/commit/3b0a82fbbb674da79521f067ae3eb11b2996d9a5))
* target the live server port for server-backed CLI commands ([9c82449](https://github.com/centdix/webmux/commit/9c824495eff3902fe3f614329c888d42793c56e9))
* tear down tab parking windows and serialize tab mutations ([c649fe4](https://github.com/centdix/webmux/commit/c649fe4f1de91ccf24e88d5ddc4fad3aae0c9d87))
* tell the server when a notification toast auto-dismisses ([5979ed5](https://github.com/centdix/webmux/commit/5979ed5d4a567e5f3103b375047c8fb619360090))
* **tmux:** force a UTF-8 locale for tmux control commands ([#293](https://github.com/centdix/webmux/issues/293)) ([e725f3b](https://github.com/centdix/webmux/commit/e725f3be7a0dd0bd7f960b7b2641a37b900e6fb8))
* track GitHub GraphQL and REST rate-limit backoff separately per repo ([40880be](https://github.com/centdix/webmux/commit/40880be4fb3de64a5f5a28da97ca6e572c137074))
* track Linear auto-create claim owners and release them on re-enable and project removal ([ceadd3c](https://github.com/centdix/webmux/commit/ceadd3c951cc0757fef4c3bcecfc3c6495a38ab8))
* track loaded projects per poll success and drop out-of-order polls ([9fc54ba](https://github.com/centdix/webmux/commit/9fc54ba1d1e8d273c5623ee860f81f6df224c1b1))
* truncate long worktree names in header ([#133](https://github.com/centdix/webmux/issues/133)) ([8cec301](https://github.com/centdix/webmux/commit/8cec30143ec9fc1ecb74573d5cba4c01821129e6))
* use canonical codex hooks flag ([#244](https://github.com/centdix/webmux/issues/244)) ([d2ef583](https://github.com/centdix/webmux/commit/d2ef583c3cdf4bfe55da3e728f6e406ca77d55cb))
* use correct `script` command syntax on macOS ([4f3d5ef](https://github.com/centdix/webmux/commit/4f3d5efd59e06810203bcbb7023cc06ecd2413b5))
* use direnv exec for lifecycle hooks to provide nix dev shell env ([#82](https://github.com/centdix/webmux/issues/82)) ([3d0d2c5](https://github.com/centdix/webmux/commit/3d0d2c516c9b634b0f670a84e0f0bb08fbca3dd8))
* use host callback url for sandbox hooks ([#211](https://github.com/centdix/webmux/issues/211)) ([e4cc15e](https://github.com/centdix/webmux/commit/e4cc15e02f42d8d5c49118d78b56b577b621d112))
* use python pty.spawn instead of script on macOS ([26aeeeb](https://github.com/centdix/webmux/commit/26aeeeb3106a9c8e074be7ffefa6cd9606dadcff))
* widen a sidebar width saved before the project rail by the rail ([c70ea59](https://github.com/centdix/webmux/commit/c70ea5997416c3a3f0bbe75e9cc5c568882d822e))
* widen creation dialog and prompt input ([#126](https://github.com/centdix/webmux/issues/126)) ([98ea7b1](https://github.com/centdix/webmux/commit/98ea7b1d8e94bcb3fd3d0eafe1922fd8534f29ec))
* wrap notification toast text ([#177](https://github.com/centdix/webmux/issues/177)) ([9224da9](https://github.com/centdix/webmux/commit/9224da9fb4b105216e0fd5ce1f5d4918e36076ec))
* wrap topbar badges before action buttons ([#168](https://github.com/centdix/webmux/issues/168)) ([2bace2f](https://github.com/centdix/webmux/commit/2bace2f18f3aa7f651c40df653bff0e295aadcb7))


### Performance

* increase github PR polling rate from 20s to 10s ([#162](https://github.com/centdix/webmux/issues/162)) ([888d36c](https://github.com/centdix/webmux/commit/888d36ca4e48c8aad05369ec4bf0a00ba8bbee5f))
* lazy-load diff dialog ([#217](https://github.com/centdix/webmux/issues/217)) ([93b5cce](https://github.com/centdix/webmux/commit/93b5cce472550ed530bdbdcdf54910d42a3f4f2a))
* reduce GitHub API usage by scoping PR polls to active worktrees ([5634a8e](https://github.com/centdix/webmux/commit/5634a8e268f9aeaaba09f39667723bdc13254735))
* trim dashboard polling and test overhead ([#202](https://github.com/centdix/webmux/issues/202)) ([32baa8b](https://github.com/centdix/webmux/commit/32baa8baa864cab3228dd6d090985471defbd344))

## [0.43.1](https://github.com/windmill-labs/webmux/compare/v0.43.0...v0.43.1) (2026-07-23)


### Bug Fixes

* **pr:** stop cancelled CI runs from masking the latest review status ([#298](https://github.com/windmill-labs/webmux/issues/298)) ([9001d9f](https://github.com/windmill-labs/webmux/commit/9001d9f92d94d151add9983dc32a7d1384fd3945))

## [0.43.0](https://github.com/windmill-labs/webmux/compare/v0.42.0...v0.43.0) (2026-07-20)


### Features

* load global config env from ~/.config/webmux/.env ([#295](https://github.com/windmill-labs/webmux/issues/295)) ([d62612e](https://github.com/windmill-labs/webmux/commit/d62612e71e12c00664d3463d91f51f0acc9bf2c9))


### Bug Fixes

* **tmux:** force a UTF-8 locale for tmux control commands ([#293](https://github.com/windmill-labs/webmux/issues/293)) ([e725f3b](https://github.com/windmill-labs/webmux/commit/e725f3be7a0dd0bd7f960b7b2641a37b900e6fb8))

## [0.42.0](https://github.com/windmill-labs/webmux/compare/v0.41.2...v0.42.0) (2026-07-17)


### Features

* order worktree list by session and pr state ([#289](https://github.com/windmill-labs/webmux/issues/289)) ([44bd900](https://github.com/windmill-labs/webmux/commit/44bd900efa85dae03cc0c3abd3c268cab2639b55))


### Bug Fixes

* **auto-remove:** sweep merged worktrees headlessly ([#291](https://github.com/windmill-labs/webmux/issues/291)) ([70c51e4](https://github.com/windmill-labs/webmux/commit/70c51e43e75b7208a7a9040bbf98762d6d22aa4a))

## [0.41.2](https://github.com/windmill-labs/webmux/compare/v0.41.1...v0.41.2) (2026-07-16)


### Bug Fixes

* restore agent status by prefixing the runtime control URL ([d168301](https://github.com/windmill-labs/webmux/commit/d16830192fdcc5dfa81bff33df544f60bb136b25))
* restore agent status by prefixing the runtime control URL ([d7fba24](https://github.com/windmill-labs/webmux/commit/d7fba241c00714d9d5e3cecd9e31c8c36d696001))

## [0.41.1](https://github.com/windmill-labs/webmux/compare/v0.41.0...v0.41.1) (2026-07-14)


### Bug Fixes

* keep launch project .env secrets out of tmux global env ([#285](https://github.com/windmill-labs/webmux/issues/285)) ([153ce85](https://github.com/windmill-labs/webmux/commit/153ce85bfe7c99edd967d5cb75ef67b03fe7a78b))
* **linear:** don't treat a linked github issue as a PR ([#287](https://github.com/windmill-labs/webmux/issues/287)) ([b8600a0](https://github.com/windmill-labs/webmux/commit/b8600a0091034edab3037472487b3cedf0c493fd))

## [0.41.0](https://github.com/windmill-labs/webmux/compare/v0.40.0...v0.41.0) (2026-06-30)


### Features

* add create sub-worktree shortcut to worktree menu ([#269](https://github.com/windmill-labs/webmux/issues/269)) ([f40807f](https://github.com/windmill-labs/webmux/commit/f40807f2445c418be22ed12e959c11b9297a9309))
* let webmux service run anywhere and add non-interactive install ([#282](https://github.com/windmill-labs/webmux/issues/282)) ([4013397](https://github.com/windmill-labs/webmux/commit/40133971ea3dce9d85ceb86c35d3d6a1074a3342))

## [0.40.0](https://github.com/windmill-labs/webmux/compare/v0.39.0...v0.40.0) (2026-06-27)


### Features

* periodically save open sessions and add webmux restore ([a96f16d](https://github.com/windmill-labs/webmux/commit/a96f16d70bbc5cb700a015a578e9a6865d0adcee))
* periodically save open sessions and add webmux restore ([0b41b19](https://github.com/windmill-labs/webmux/commit/0b41b199a911cfc60245305d4b0fd8f1ee13b2c4))
* prune only closed worktrees instead of all ([0fa2da6](https://github.com/windmill-labs/webmux/commit/0fa2da67d05a705820a38643cb71f3a72cad2063))
* prune only closed worktrees instead of all ([164e7fc](https://github.com/windmill-labs/webmux/commit/164e7fcbc1a699a94dace10b0d095f8896c497e1))

## [0.39.0](https://github.com/windmill-labs/webmux/compare/v0.38.0...v0.39.0) (2026-06-22)


### Features

* serve all projects from one webmux dashboard on one port ([#271](https://github.com/windmill-labs/webmux/issues/271)) ([034b460](https://github.com/windmill-labs/webmux/commit/034b46055dc0f8448e3f7ac579e3b3e8889c0854))
* set up a project on add (scaffold + analyze with Claude), observably ([#278](https://github.com/windmill-labs/webmux/issues/278)) ([b6411da](https://github.com/windmill-labs/webmux/commit/b6411dae3403ab785007e440807d8d1a5c014693))

## [0.38.0](https://github.com/windmill-labs/webmux/compare/v0.37.0...v0.38.0) (2026-06-20)


### Features

* add claude conversation streaming ([#262](https://github.com/windmill-labs/webmux/issues/262)) ([6b04e83](https://github.com/windmill-labs/webmux/commit/6b04e8344a0f8295369c018a7331511d348a6b54))
* add forkable tabs for claude/codex agent sessions ([39bb904](https://github.com/windmill-labs/webmux/commit/39bb904b729b38fd51ca70bed4e168ebcfd20f76))
* AI-polish Linear issue titles in web create-ticket path ([fd8ecf6](https://github.com/windmill-labs/webmux/commit/fd8ecf6b8217af74089bea0be6a41c328fa83d1f))
* AI-polish Linear issue titles in web create-ticket path ([9d505bf](https://github.com/windmill-labs/webmux/commit/9d505bfe23f57dd017bfa55f5d4c4746c8db0688))
* render AskUserQuestion tool as a clickable web-chat card ([#276](https://github.com/windmill-labs/webmux/issues/276)) ([4b7a659](https://github.com/windmill-labs/webmux/commit/4b7a659534600bd4fc657017c7c58a5ca7da7393))


### Bug Fixes

* keep claude chat stream open across turns to preserve message order ([#274](https://github.com/windmill-labs/webmux/issues/274)) ([3d35c34](https://github.com/windmill-labs/webmux/commit/3d35c342f9acd26355e8a67a162ac687259e3c3b))
* live web-chat updates for terminal-initiated Claude turns ([#275](https://github.com/windmill-labs/webmux/issues/275)) ([a55f06c](https://github.com/windmill-labs/webmux/commit/a55f06cedfa541a669857ef0b58bdb5b2ba358d1))
* reset web-chat worktree status from owned claude -p run ([#273](https://github.com/windmill-labs/webmux/issues/273)) ([5753794](https://github.com/windmill-labs/webmux/commit/57537941e3eaada34c998894d233ab025aae2067))
* tear down tab parking windows and serialize tab mutations ([c649fe4](https://github.com/windmill-labs/webmux/commit/c649fe4f1de91ccf24e88d5ddc4fad3aae0c9d87))

## [0.37.0](https://github.com/windmill-labs/webmux/compare/v0.36.0...v0.37.0) (2026-06-09)


### Features

* clearer worktree status indicators ([#265](https://github.com/windmill-labs/webmux/issues/265)) ([4b528a7](https://github.com/windmill-labs/webmux/commit/4b528a7aa2fdad404fd869979b053e89607ced95))

## [0.36.0](https://github.com/windmill-labs/webmux/compare/v0.35.0...v0.36.0) (2026-06-01)


### Features

* improve codex web chat feedback ([#258](https://github.com/windmill-labs/webmux/issues/258)) ([8adbdef](https://github.com/windmill-labs/webmux/commit/8adbdef5019cdeccfad55f8dab51661a4af7691c))


### Bug Fixes

* recognize Bun's connection-refused message in formatServerError ([a7d78f7](https://github.com/windmill-labs/webmux/commit/a7d78f7d7ea32a9b195315812681949140f3f017))
* recognize Bun's connection-refused message in formatServerError ([3a67ffb](https://github.com/windmill-labs/webmux/commit/3a67ffb12ef5185a09fa4efaf7d99785e4067c48))
* refine agent chat ui ([#260](https://github.com/windmill-labs/webmux/issues/260)) ([632c504](https://github.com/windmill-labs/webmux/commit/632c504ef775e5758f9f830c1611f206d4921560))
* target the live server port for server-backed CLI commands ([3b0a82f](https://github.com/windmill-labs/webmux/commit/3b0a82fbbb674da79521f067ae3eb11b2996d9a5))
* target the live server port for server-backed CLI commands ([9c82449](https://github.com/windmill-labs/webmux/commit/9c824495eff3902fe3f614329c888d42793c56e9))

## [0.35.0](https://github.com/windmill-labs/webmux/compare/v0.34.0...v0.35.0) (2026-05-27)


### Features

* add web chat ui setting ([#252](https://github.com/windmill-labs/webmux/issues/252)) ([4126a4c](https://github.com/windmill-labs/webmux/commit/4126a4c336e355dd0117f4fe1f9dae361eea9f87))
* bake env vars into webmux service unit via --env and auto-pickup ([b790a50](https://github.com/windmill-labs/webmux/commit/b790a50230b1aa137e04ed4efaeea34cd62cd58c))
* bake env vars into webmux service unit via --env and auto-pickup ([88e111d](https://github.com/windmill-labs/webmux/commit/88e111db9cd3c7ba6376d76368f63d6dba9eb250))
* polish Linear issue title and detect duplicates on --linear &lt;TEAM&gt; ([d2538d8](https://github.com/windmill-labs/webmux/commit/d2538d80632a79fad27146c6f472c19579d746f9))
* polish Linear issue title and detect duplicates on --linear &lt;TEAM&gt; ([88f0af6](https://github.com/windmill-labs/webmux/commit/88f0af6e681843f95eda688ad2368e013822a02c))
* post Linear comment when auto-create picks up an issue ([9c0bc35](https://github.com/windmill-labs/webmux/commit/9c0bc35a51011bc56d2a8d41451d12f7a43fa358))
* post Linear comment when auto-create picks up an issue ([6d91151](https://github.com/windmill-labs/webmux/commit/6d91151f51ba0fae724dde85dacdc13de7e9f556))
* stream codex chat and refresh stale terminals ([#254](https://github.com/windmill-labs/webmux/issues/254)) ([6fcd2c6](https://github.com/windmill-labs/webmux/commit/6fcd2c6ec06458ef76fb138db325411a56565971))


### Bug Fixes

* address review nits on Linear title polish + dedup ([70bd58c](https://github.com/windmill-labs/webmux/commit/70bd58c5f4569ba561d34a6f8ae04e7ba497e068))
* don't close dialog when drag-selecting text out of modal ([dc41a31](https://github.com/windmill-labs/webmux/commit/dc41a313945a768b1e0743224132085d1e65759b))
* don't close dialog when drag-selecting text out of modal ([92a611a](https://github.com/windmill-labs/webmux/commit/92a611ad7d0987c0b42624a93686a480cd77cd62))
* handle codex assistant message fields ([#256](https://github.com/windmill-labs/webmux/issues/256)) ([e834209](https://github.com/windmill-labs/webmux/commit/e8342096d9d79a9582034ca8674971fc1f8b7471))
* report the resolved working branch in oneshot pickup comments ([31c9f55](https://github.com/windmill-labs/webmux/commit/31c9f5553daa8217453ffa83454004febae6982e))
* revert \$teamId to ID! — Linear rejects String! in this filter ([18b3653](https://github.com/windmill-labs/webmux/commit/18b36533a6782f882573f1d945404915d8882914))
* scope stale terminal banner to terminal pane ([#255](https://github.com/windmill-labs/webmux/issues/255)) ([e06682f](https://github.com/windmill-labs/webmux/commit/e06682f2c5a73af7a248792ace42e2df7e84dfd9))
* stop polish from running the prompt as a task ([ccd87b7](https://github.com/windmill-labs/webmux/commit/ccd87b73b928ec747c1afc315f37a268177693cc))

## [0.34.0](https://github.com/windmill-labs/webmux/compare/v0.33.0...v0.34.0) (2026-05-19)


### Features

* auto-pick a free port in webmux service install ([#243](https://github.com/windmill-labs/webmux/issues/243)) ([052f5f9](https://github.com/windmill-labs/webmux/commit/052f5f90ad7fcb61a4d8ae426e5bc565cc5b5624))


### Bug Fixes

* use canonical codex hooks flag ([#244](https://github.com/windmill-labs/webmux/issues/244)) ([d2ef583](https://github.com/windmill-labs/webmux/commit/d2ef583c3cdf4bfe55da3e728f6e406ca77d55cb))

## [0.33.0](https://github.com/windmill-labs/webmux/compare/v0.32.0...v0.33.0) (2026-05-18)


### Features

* redirect /&lt;prefix&gt; across symmetric webmux instances ([#241](https://github.com/windmill-labs/webmux/issues/241)) ([ad0b1dc](https://github.com/windmill-labs/webmux/commit/ad0b1dcc0cde11fb12910fdbe6c0497f769f8c22))
* scope linear watcher per team and pick ticket team in UI ([#240](https://github.com/windmill-labs/webmux/issues/240)) ([729e51b](https://github.com/windmill-labs/webmux/commit/729e51b1cca507ab662e34f4e3956ec2b2166846))

## [0.32.0](https://github.com/windmill-labs/webmux/compare/v0.31.2...v0.32.0) (2026-05-18)


### Features

* webmux oneshot + Linear round-trip, server-driven watcher ([#238](https://github.com/windmill-labs/webmux/issues/238)) ([d43ad25](https://github.com/windmill-labs/webmux/commit/d43ad25ef95524553ce532c2dd2506a38134ebe4))

## [0.31.2](https://github.com/windmill-labs/webmux/compare/v0.31.1...v0.31.2) (2026-05-13)


### Bug Fixes

* survive stale git worktree registrations ([#236](https://github.com/windmill-labs/webmux/issues/236)) ([cf72b1b](https://github.com/windmill-labs/webmux/commit/cf72b1b5aca95941b8f08f74ce4beddd9cbe637b))

## [0.31.1](https://github.com/windmill-labs/webmux/compare/v0.31.0...v0.31.1) (2026-05-13)


### Bug Fixes

* decouple linear auto-create from dashboard ([#235](https://github.com/windmill-labs/webmux/issues/235)) ([14fe259](https://github.com/windmill-labs/webmux/commit/14fe2598759febce1e35c09be18efedae4fc29bf))
* move worktree badges below names ([#233](https://github.com/windmill-labs/webmux/issues/233)) ([63130ac](https://github.com/windmill-labs/webmux/commit/63130ac1955dad21172d046dd8b91e97929cb206))

## [0.31.0](https://github.com/windmill-labs/webmux/compare/v0.30.0...v0.31.0) (2026-05-12)


### Features

* add workspace labels ([#231](https://github.com/windmill-labs/webmux/issues/231)) ([04162db](https://github.com/windmill-labs/webmux/commit/04162dba0af9cfaf348d8e35195a4b64a96023cc))

## [0.30.0](https://github.com/windmill-labs/webmux/compare/v0.29.0...v0.30.0) (2026-04-29)


### Features

* add codex agent lifecycle hooks ([#229](https://github.com/windmill-labs/webmux/issues/229)) ([133e8cd](https://github.com/windmill-labs/webmux/commit/133e8cd349edeaafcc3050bfa4246b1bda84e171))


### Bug Fixes

* delay codex terminal prompt submission ([#226](https://github.com/windmill-labs/webmux/issues/226)) ([6964d29](https://github.com/windmill-labs/webmux/commit/6964d29bcbdd15d4990df83f582dbbb035129ecb))

## [0.29.0](https://github.com/windmill-labs/webmux/compare/v0.28.1...v0.29.0) (2026-04-28)


### Features

* add custom agents and multi-agent worktrees ([#222](https://github.com/windmill-labs/webmux/issues/222)) ([ef76e92](https://github.com/windmill-labs/webmux/commit/ef76e924e5c4b823c72049829ea2917d066906c9))


### Bug Fixes

* extend auto-name timeout fallback ([#223](https://github.com/windmill-labs/webmux/issues/223)) ([50875b1](https://github.com/windmill-labs/webmux/commit/50875b11642be1002522cf21d8c838235a960127))
* move api-contract to devDependencies to unbreak global install ([#225](https://github.com/windmill-labs/webmux/issues/225)) ([73a6174](https://github.com/windmill-labs/webmux/commit/73a6174992a4aa2f77fe75443bf62ca868be129b))

## [0.28.1](https://github.com/windmill-labs/webmux/compare/v0.28.0...v0.28.1) (2026-04-21)


### Bug Fixes

* lock diff viewer to dark colors ([#220](https://github.com/windmill-labs/webmux/issues/220)) ([efdf13f](https://github.com/windmill-labs/webmux/commit/efdf13fda1875e7bc27c9dfd2324e3a58ef97942))

## [0.28.0](https://github.com/windmill-labs/webmux/compare/v0.27.1...v0.28.0) (2026-04-20)


### Features

* add non-terminal chat ui for codex and claude ([#216](https://github.com/windmill-labs/webmux/issues/216)) ([bd1b91a](https://github.com/windmill-labs/webmux/commit/bd1b91a2af6a39c8a0fd75aff746bf110f8d0d74))
* share api contract across backend and frontend ([#213](https://github.com/windmill-labs/webmux/issues/213)) ([47b26be](https://github.com/windmill-labs/webmux/commit/47b26be5aec24716144278c836ffb3020d33a4af))


### Bug Fixes

* keep dashboard pr sync active ([#219](https://github.com/windmill-labs/webmux/issues/219)) ([79371cb](https://github.com/windmill-labs/webmux/commit/79371cb5fa337c53d0e91bbbef075b0cf2c87867))


### Performance

* lazy-load diff dialog ([#217](https://github.com/windmill-labs/webmux/issues/217)) ([93b5cce](https://github.com/windmill-labs/webmux/commit/93b5cce472550ed530bdbdcdf54910d42a3f4f2a))
* trim dashboard polling and test overhead ([#202](https://github.com/windmill-labs/webmux/issues/202)) ([32baa8b](https://github.com/windmill-labs/webmux/commit/32baa8baa864cab3228dd6d090985471defbd344))

## [0.27.1](https://github.com/windmill-labs/webmux/compare/v0.27.0...v0.27.1) (2026-04-09)


### Bug Fixes

* stabilize docker sandbox shell startup ([#209](https://github.com/windmill-labs/webmux/issues/209)) ([da32507](https://github.com/windmill-labs/webmux/commit/da32507c4c3643d1213b97a0a72669aec56997ff))
* use host callback url for sandbox hooks ([#211](https://github.com/windmill-labs/webmux/issues/211)) ([e4cc15e](https://github.com/windmill-labs/webmux/commit/e4cc15e02f42d8d5c49118d78b56b577b621d112))

## [0.27.0](https://github.com/windmill-labs/webmux/compare/v0.26.0...v0.27.0) (2026-04-09)


### Features

* add worktree search and archive controls ([#206](https://github.com/windmill-labs/webmux/issues/206)) ([c68b8da](https://github.com/windmill-labs/webmux/commit/c68b8daf156538682339f0c51d9e419b19457103))
* reuse toast component for ui feedback ([#207](https://github.com/windmill-labs/webmux/issues/207)) ([0c15532](https://github.com/windmill-labs/webmux/commit/0c15532e82d5322441fd5a8fa25675b3a1bf7392))


### Bug Fixes

* add auto-name timeout fallback ([#205](https://github.com/windmill-labs/webmux/issues/205)) ([066375a](https://github.com/windmill-labs/webmux/commit/066375a274af5482b423637fa6f40009a8e8417b))

## [0.26.0](https://github.com/windmill-labs/webmux/compare/v0.25.0...v0.26.0) (2026-04-03)


### Features

* support `--agent=both` in the CLI ([#200](https://github.com/windmill-labs/webmux/issues/200)) ([1a8b32b](https://github.com/windmill-labs/webmux/commit/1a8b32b34cd5454b9439b1a6c2b70062cb4812a6))


### Bug Fixes

* remove svelte build warnings ([#198](https://github.com/windmill-labs/webmux/issues/198)) ([8c679bb](https://github.com/windmill-labs/webmux/commit/8c679bbba7ca0f6499d0c3c82a8c24a645c19115))

## [0.25.0](https://github.com/windmill-labs/webmux/compare/v0.24.1...v0.25.0) (2026-03-31)


### Features

* add --existing flag to `wm add` for resuming work on remote branches ([0cae50c](https://github.com/windmill-labs/webmux/commit/0cae50c86286b8859143e15e90000a4c98c27a54))

## [0.24.1](https://github.com/windmill-labs/webmux/compare/v0.24.0...v0.24.1) (2026-03-31)


### Bug Fixes

* remove --max-tokens use ([e42e175](https://github.com/windmill-labs/webmux/commit/e42e175fa97492b1e47f6a7144ebffb79c2710de))

## [0.24.0](https://github.com/windmill-labs/webmux/compare/v0.23.0...v0.24.0) (2026-03-31)


### Features

* add paired claude and codex worktrees ([#193](https://github.com/windmill-labs/webmux/issues/193)) ([004404f](https://github.com/windmill-labs/webmux/commit/004404f5769633e09ce64529ce165eeee4e74dd1))
* improve auto-name error reporting and speed ([3c8c984](https://github.com/windmill-labs/webmux/commit/3c8c984717f4f6826bb9f1fed92b5f08cd043333))
* improve auto-name error reporting and speed ([3c8c984](https://github.com/windmill-labs/webmux/commit/3c8c984717f4f6826bb9f1fed92b5f08cd043333))
* improve auto-name error reporting and speed ([b6b51d2](https://github.com/windmill-labs/webmux/commit/b6b51d2cad6a08c17e5b856e5f654f28d2cec7af))
* show git status in diff dialog ([#192](https://github.com/windmill-labs/webmux/issues/192)) ([4d587f5](https://github.com/windmill-labs/webmux/commit/4d587f56d0ea3e01a386fd06467f5c5c8c90e9b7))


### Bug Fixes

* soften review comment prompt ([#194](https://github.com/windmill-labs/webmux/issues/194)) ([53b952e](https://github.com/windmill-labs/webmux/commit/53b952e7157fe9f2d860ac99bf80324e19215250))

## [0.23.0](https://github.com/windmill-labs/webmux/compare/v0.22.1...v0.23.0) (2026-03-27)


### Features

* show creation status logs in CLI add command ([#186](https://github.com/windmill-labs/webmux/issues/186)) ([2d8a82f](https://github.com/windmill-labs/webmux/commit/2d8a82f5e7a75f13b0985b8802927e73bd8eb1e7))


### Bug Fixes

* collapse newlines in agent command quoteShell to prevent tmux send-keys splitting ([#189](https://github.com/windmill-labs/webmux/issues/189)) ([fdec1ac](https://github.com/windmill-labs/webmux/commit/fdec1acba9134dde25bb1b202aef76fe5eb0667d))
* prevent Safari from closing branch selector before selection ([#188](https://github.com/windmill-labs/webmux/issues/188)) ([74bc422](https://github.com/windmill-labs/webmux/commit/74bc422bea4e339325d7720dc8c3bd1a161a833b))
* send creation status logs to stdout instead of stderr ([4aab7fb](https://github.com/windmill-labs/webmux/commit/4aab7fbb14270c2e0f92926c7629ee85f485518d))

## [0.22.1](https://github.com/windmill-labs/webmux/compare/v0.22.0...v0.22.1) (2026-03-25)


### Bug Fixes

* remove hardcoded fake-repo from linked repos ([#184](https://github.com/windmill-labs/webmux/issues/184)) ([4859a80](https://github.com/windmill-labs/webmux/commit/4859a80d34fabfd4881408f1526ba9a16db7265b))

## [0.22.0](https://github.com/windmill-labs/webmux/compare/v0.21.0...v0.22.0) (2026-03-25)


### Features

* show linked repos inline in sidebar ([#182](https://github.com/windmill-labs/webmux/issues/182)) ([fa1cb0f](https://github.com/windmill-labs/webmux/commit/fa1cb0f014491c513c642819834f5278846574a8))

## [0.21.0](https://github.com/windmill-labs/webmux/compare/v0.20.0...v0.21.0) (2026-03-25)


### Features

* add remote branch toggle for existing branches ([#176](https://github.com/windmill-labs/webmux/issues/176)) ([d55448e](https://github.com/windmill-labs/webmux/commit/d55448e2f1b4115a57cd35d4d9933dfb0b3dfd28))
* expand init starter template ([#174](https://github.com/windmill-labs/webmux/issues/174)) ([c4f022e](https://github.com/windmill-labs/webmux/commit/c4f022e475607a3b389215e48582ed60e98fc585))


### Bug Fixes

* preserve init template config comments ([#178](https://github.com/windmill-labs/webmux/issues/178)) ([c1c325d](https://github.com/windmill-labs/webmux/commit/c1c325dd20bbbb4129110ea9d939dbe83c29cf63))
* show remote toggle when no branches match in selector ([#180](https://github.com/windmill-labs/webmux/issues/180)) ([f767d3a](https://github.com/windmill-labs/webmux/commit/f767d3af1d9196019f28f565c50265d076d88dfc))
* wrap notification toast text ([#177](https://github.com/windmill-labs/webmux/issues/177)) ([9224da9](https://github.com/windmill-labs/webmux/commit/9224da9fb4b105216e0fd5ce1f5d4918e36076ec))

## [0.20.0](https://github.com/windmill-labs/webmux/compare/v0.19.0...v0.20.0) (2026-03-24)


### Features

* add `webmux send` CLI command ([#172](https://github.com/windmill-labs/webmux/issues/172)) ([4a915dc](https://github.com/windmill-labs/webmux/commit/4a915dc8e8e816a139e45641815242b9e71624c0))
* add auto-close on merge and auto-pull main ([#173](https://github.com/windmill-labs/webmux/issues/173)) ([c6ae6f1](https://github.com/windmill-labs/webmux/commit/c6ae6f1d69262180751fefcf0f4b105ac19c4c00))
* add command pane workingDir ([#169](https://github.com/windmill-labs/webmux/issues/169)) ([84fcb2e](https://github.com/windmill-labs/webmux/commit/84fcb2e2b5d609f76424c1f261b74dd6e4f9c701))
* add worktree base branch support ([#170](https://github.com/windmill-labs/webmux/issues/170)) ([8d9a04b](https://github.com/windmill-labs/webmux/commit/8d9a04b3f88704404f37cc96ee3f975d81db2c82))


### Bug Fixes

* fall back to python3 pty.spawn when script is not in PATH ([#166](https://github.com/windmill-labs/webmux/issues/166)) ([8188e5a](https://github.com/windmill-labs/webmux/commit/8188e5a0bbc569b2a75c5fbeaa72702d6ecc4002))
* include remote branches in worktree branch selector ([#171](https://github.com/windmill-labs/webmux/issues/171)) ([fe2948a](https://github.com/windmill-labs/webmux/commit/fe2948ad59a5d42270463d4c02b3e059845a093b))
* wrap topbar badges before action buttons ([#168](https://github.com/windmill-labs/webmux/issues/168)) ([2bace2f](https://github.com/windmill-labs/webmux/commit/2bace2f18f3aa7f651c40df653bff0e295aadcb7))

## [0.19.0](https://github.com/windmill-labs/webmux/compare/v0.18.0...v0.19.0) (2026-03-19)


### Features

* add --app flag for browser app mode ([#143](https://github.com/windmill-labs/webmux/issues/143)) ([62b68a8](https://github.com/windmill-labs/webmux/commit/62b68a8df0b8e3db8bd53cc45615e2584d4e1df5))
* add --detach/-d flag to webmux add command ([#159](https://github.com/windmill-labs/webmux/issues/159)) ([0e144f6](https://github.com/windmill-labs/webmux/commit/0e144f6d313a566a38388663bac505ee465ea938))
* add linear ticket worktree option ([#163](https://github.com/windmill-labs/webmux/issues/163)) ([e52caf5](https://github.com/windmill-labs/webmux/commit/e52caf5d7f8d53488a58382515425f0ddb961443))
* add native terminal launch endpoint ([#158](https://github.com/windmill-labs/webmux/issues/158)) ([11ff5aa](https://github.com/windmill-labs/webmux/commit/11ff5aa896dd4441c5a6724a0eb3143cce5a3bd2))
* auto-create worktrees for Linear tickets ([#160](https://github.com/windmill-labs/webmux/issues/160)) ([53afe95](https://github.com/windmill-labs/webmux/commit/53afe95b28df9104fd8965eb2e06a3054c36363e))


### Bug Fixes

* isolate terminal sessions and serialize sync ([#138](https://github.com/windmill-labs/webmux/issues/138)) ([31f4162](https://github.com/windmill-labs/webmux/commit/31f4162683da14299eb29b3cb670ad2ccf0de6b3))
* make linear badge static in worktree list ([#161](https://github.com/windmill-labs/webmux/issues/161)) ([000ad83](https://github.com/windmill-labs/webmux/commit/000ad83693158b36b51419a5712949118fafbbda))
* show linear panel without api key ([#164](https://github.com/windmill-labs/webmux/issues/164)) ([0c8965d](https://github.com/windmill-labs/webmux/commit/0c8965d6d60f2c5ed7419a744dcf7d689691c669))


### Performance

* increase github PR polling rate from 20s to 10s ([#162](https://github.com/windmill-labs/webmux/issues/162)) ([888d36c](https://github.com/windmill-labs/webmux/commit/888d36ca4e48c8aad05369ec4bf0a00ba8bbee5f))

## [0.18.0](https://github.com/windmill-labs/webmux/compare/v0.17.0...v0.18.0) (2026-03-18)


### Features

* add reusable Toggle component for boolean startup envs ([#154](https://github.com/windmill-labs/webmux/issues/154)) ([c748618](https://github.com/windmill-labs/webmux/commit/c7486188651aa59b82a8dcf440a882f8eaeb3045))
* close dialog on outside click ([#151](https://github.com/windmill-labs/webmux/issues/151)) ([908af94](https://github.com/windmill-labs/webmux/commit/908af94edb3d40c0d8adf22ae57d8ac84b32a07e))
* diff toggle, badge labels, and comment sorting ([#150](https://github.com/windmill-labs/webmux/issues/150)) ([a9fe654](https://github.com/windmill-labs/webmux/commit/a9fe654a87779078a587d234c31981afed06b83c))
* resizable worktree list sidebar panel ([#153](https://github.com/windmill-labs/webmux/issues/153)) ([bf7c4ba](https://github.com/windmill-labs/webmux/commit/bf7c4ba379a5293b62c58e2e988a1cfe3c36ad53))

## [0.17.0](https://github.com/windmill-labs/webmux/compare/v0.16.0...v0.17.0) (2026-03-17)


### Features

* allow worktreeRoot override from webmux.local.yaml ([#146](https://github.com/windmill-labs/webmux/issues/146)) ([241f39d](https://github.com/windmill-labs/webmux/commit/241f39d5916e34a118083987020a5188ba7a607e))
* dirty badge diff dialog ([#148](https://github.com/windmill-labs/webmux/issues/148)) ([4cd95dd](https://github.com/windmill-labs/webmux/commit/4cd95ddcc577e7a08c13563f05cb31dae5f61af1))
* show preview panel for closed worktrees instead of auto-opening ([#144](https://github.com/windmill-labs/webmux/issues/144)) ([9132c95](https://github.com/windmill-labs/webmux/commit/9132c95be6c92ebf15128554adb46b03cb5dda37))
* terminal drag-and-drop image upload ([#147](https://github.com/windmill-labs/webmux/issues/147)) ([3c78567](https://github.com/windmill-labs/webmux/commit/3c7856744e36a627b02f39bbfa9c197a6dadae6f))


### Bug Fixes

* add missing static/.assetsignore for cloudflare pages build ([dcf51ea](https://github.com/windmill-labs/webmux/commit/dcf51ea62eb5ae449722c1218ffd885e30c90749))
* add wrangler.toml for cloudflare pages deploy ([be35397](https://github.com/windmill-labs/webmux/commit/be35397fb5b9e7ab9ba4e23a1a2f7ca7141d99c2))
* filter ci logs to show only the selected check's job ([#145](https://github.com/windmill-labs/webmux/issues/145)) ([1114094](https://github.com/windmill-labs/webmux/commit/111409425701fd0ddefb59773e51e96fc80b57af))

## [0.16.0](https://github.com/windmill-labs/webmux/compare/v0.15.0...v0.16.0) (2026-03-13)


### Features

* persist last selected worktree ([#135](https://github.com/windmill-labs/webmux/issues/135)) ([62d82b9](https://github.com/windmill-labs/webmux/commit/62d82b9a367d787a5614beaf95ab42d8b7d87ea5))


### Bug Fixes

* keep selected worktree on create ([#136](https://github.com/windmill-labs/webmux/issues/136)) ([224c3a6](https://github.com/windmill-labs/webmux/commit/224c3a60e7a4fa16841f35c7a04599a32c3a7e72))
* truncate long worktree names in header ([#133](https://github.com/windmill-labs/webmux/issues/133)) ([8cec301](https://github.com/windmill-labs/webmux/commit/8cec30143ec9fc1ecb74573d5cba4c01821129e6))

## [0.15.0](https://github.com/windmill-labs/webmux/compare/v0.14.0...v0.15.0) (2026-03-12)


### Features

* add mobile more button for PR badges, CI, and comments ([#122](https://github.com/windmill-labs/webmux/issues/122)) ([f9a8c37](https://github.com/windmill-labs/webmux/commit/f9a8c37f3e15cd93779cbd8bfdf57b9ac5de489e))
* add settings icon with theme selection ([#130](https://github.com/windmill-labs/webmux/issues/130)) ([972e38e](https://github.com/windmill-labs/webmux/commit/972e38eff5581466429f2f850bbcb9bf0ee56e25))
* add webmux local yaml overlays ([#129](https://github.com/windmill-labs/webmux/issues/129)) ([37b005d](https://github.com/windmill-labs/webmux/commit/37b005d0aa9299523a18d2847222e12cb7827af8))
* group pr ci and comment badges ([#132](https://github.com/windmill-labs/webmux/issues/132)) ([f173bbf](https://github.com/windmill-labs/webmux/commit/f173bbf2148f9b365ce348ccf9d8b8e141068102))


### Bug Fixes

* harden tmux closed-session handling ([#128](https://github.com/windmill-labs/webmux/issues/128)) ([a9b941f](https://github.com/windmill-labs/webmux/commit/a9b941f385146cc0ca15df246553ee713ccf0289))
* reconnect terminal after idle disconnect ([#127](https://github.com/windmill-labs/webmux/issues/127)) ([9f107d0](https://github.com/windmill-labs/webmux/commit/9f107d071a5232eba1c903d80610b9d95ec431e6))
* resolve remove from linked worktree ([#125](https://github.com/windmill-labs/webmux/issues/125)) ([b0b1c70](https://github.com/windmill-labs/webmux/commit/b0b1c70d4b41aa75abfee4ff5cafc8c36e2319df))
* restore mobile agent pane scrolling ([#123](https://github.com/windmill-labs/webmux/issues/123)) ([d62f062](https://github.com/windmill-labs/webmux/commit/d62f0627c36ed25ecea8972ba57e34d0f8231c4b))
* switch to tmux window after webmux open ([#121](https://github.com/windmill-labs/webmux/issues/121)) ([6f6d0fa](https://github.com/windmill-labs/webmux/commit/6f6d0faa9023ebc672977190726c43bb353fb254))
* widen creation dialog and prompt input ([#126](https://github.com/windmill-labs/webmux/issues/126)) ([98ea7b1](https://github.com/windmill-labs/webmux/commit/98ea7b1d8e94bcb3fd3d0eafe1922fd8534f29ec))

## [0.14.0](https://github.com/windmill-labs/webmux/compare/v0.13.0...v0.14.0) (2026-03-11)


### Features

* notify changelog to discord on release ([365d73f](https://github.com/windmill-labs/webmux/commit/365d73f1e650db7720d43dad59e78efec20a12dd))

## [0.13.0](https://github.com/windmill-labs/webmux/compare/v0.12.0...v0.13.0) (2026-03-11)


### Features

* add existing branch worktree picker ([#119](https://github.com/windmill-labs/webmux/issues/119)) ([93e0bd8](https://github.com/windmill-labs/webmux/commit/93e0bd806b13eafecdc07d5cdc73272f631b48de))
* add webmux prune command ([#118](https://github.com/windmill-labs/webmux/issues/118)) ([eda234a](https://github.com/windmill-labs/webmux/commit/eda234a810e91209bf130eecc81e674be2d8edda))


### Bug Fixes

* isolate pane base index from user tmux config ([#115](https://github.com/windmill-labs/webmux/issues/115)) ([5308220](https://github.com/windmill-labs/webmux/commit/53082200e72ae1d8c2f84a653b26e9b4d59869ff))
* resume agent sessions on reopen ([#116](https://github.com/windmill-labs/webmux/issues/116)) ([6748292](https://github.com/windmill-labs/webmux/commit/6748292f20c197804842ac9f9eccf6c4c38f6b3c))

## [0.12.0](https://github.com/windmill-labs/webmux/compare/v0.11.0...v0.12.0) (2026-03-11)


### Features

* add --version / -V flag ([#101](https://github.com/windmill-labs/webmux/issues/101)) ([4d3e614](https://github.com/windmill-labs/webmux/commit/4d3e6147605a92d9f6fd6eeb2851e3697feeac1b))
* add shell autocompletion for CLI commands ([#100](https://github.com/windmill-labs/webmux/issues/100)) ([d08512d](https://github.com/windmill-labs/webmux/commit/d08512de69ba2b7315371ecbeeb49ecdd29eec2d))
* enforce 40-char max on auto-generated branch names ([#108](https://github.com/windmill-labs/webmux/issues/108)) ([10311f6](https://github.com/windmill-labs/webmux/commit/10311f65774fcdc6c43f9993cd17ba244eec2c6a))
* migrate site docs to sveltekit ([#113](https://github.com/windmill-labs/webmux/issues/113)) ([9b53372](https://github.com/windmill-labs/webmux/commit/9b53372bb69a628c999c231f5180652589228291))
* redesign header with per-repo rows and linked repo cursor button ([#104](https://github.com/windmill-labs/webmux/issues/104)) ([40e2256](https://github.com/windmill-labs/webmux/commit/40e225643eed3f99b9f9ab497e344b9f5728108a))
* show creating indicator in worktree list instead of blocking dialog ([#99](https://github.com/windmill-labs/webmux/issues/99)) ([c388ee5](https://github.com/windmill-labs/webmux/commit/c388ee562271b764cd058674b2b3bd5c0199bf9c))
* show creating worktree at top of list instead of bottom ([#103](https://github.com/windmill-labs/webmux/issues/103)) ([e3a8440](https://github.com/windmill-labs/webmux/commit/e3a8440264be54eb7ee6532d509307530e909916))
* surface backend worktree creation progress ([#112](https://github.com/windmill-labs/webmux/issues/112)) ([c193879](https://github.com/windmill-labs/webmux/commit/c193879fcfa9da350379c412a53f62d6d7ca968a))


### Bug Fixes

* append branch name to linked repo cursor URL path ([#107](https://github.com/windmill-labs/webmux/issues/107)) ([64a877a](https://github.com/windmill-labs/webmux/commit/64a877af585de98f5c8abb0b13e4725cfcd97d68))
* filter duplicate worktree entry while creating ([#105](https://github.com/windmill-labs/webmux/issues/105)) ([c64f670](https://github.com/windmill-labs/webmux/commit/c64f670021f8008bac08cadfe33bcca384dac829))
* force pane-base-index 0 on managed tmux sessions ([#98](https://github.com/windmill-labs/webmux/issues/98)) ([f326134](https://github.com/windmill-labs/webmux/commit/f326134abf4e26843d08ad87aea30628df2826b0))
* parse serve flags after subcommand ([#95](https://github.com/windmill-labs/webmux/issues/95)) ([a09918f](https://github.com/windmill-labs/webmux/commit/a09918fcb2d65094a2db9ccc3b2aa56ac0e24196))
* persist startupEnvs and checkbox state in save as default ([#109](https://github.com/windmill-labs/webmux/issues/109)) ([7b26564](https://github.com/windmill-labs/webmux/commit/7b26564d684b42bbd4d225103bb5eea771bc46ac))
* register zsh completion for webmux ([#102](https://github.com/windmill-labs/webmux/issues/102)) ([195822d](https://github.com/windmill-labs/webmux/commit/195822d7a1283e2bffecc646387ac4f4cb64a423))
* reload dotenv after post-create hook ([#111](https://github.com/windmill-labs/webmux/issues/111)) ([5402897](https://github.com/windmill-labs/webmux/commit/54028975c64214b0ac6462b7ff398fd843843ffa))
* resolve relative linked repo dir and support array github config ([#106](https://github.com/windmill-labs/webmux/issues/106)) ([43d80dd](https://github.com/windmill-labs/webmux/commit/43d80dd4e7ceab83b0cd54be8f0c38303c11bc58))
* restore claude hooks after post-create ([#114](https://github.com/windmill-labs/webmux/issues/114)) ([8ac4528](https://github.com/windmill-labs/webmux/commit/8ac4528635b06e861474375192efb74339a54f21))
* simplify worktree create loading state ([#110](https://github.com/windmill-labs/webmux/issues/110)) ([2fc6722](https://github.com/windmill-labs/webmux/commit/2fc67227f4c265cc264a06eca2fb5fe65836b318))

## [0.11.0](https://github.com/windmill-labs/webmux/compare/v0.10.1...v0.11.0) (2026-03-11)


### Features

* add `webmux serve` command, bare `webmux` now shows help ([#90](https://github.com/windmill-labs/webmux/issues/90)) ([e1ca9f5](https://github.com/windmill-labs/webmux/commit/e1ca9f5a7d2a0dcec8f37264bd861c17160a0ff8))
* add webmux update command ([#92](https://github.com/windmill-labs/webmux/issues/92)) ([3f64a25](https://github.com/windmill-labs/webmux/commit/3f64a258e641bd5ea25077c7d19593b12f22250c))
* use claude/codex CLI for auto-name instead of direct API calls ([#94](https://github.com/windmill-labs/webmux/issues/94)) ([5d313e8](https://github.com/windmill-labs/webmux/commit/5d313e81d08758cc940fc3e6229b3ecbd9ce0982))

## [0.10.1](https://github.com/windmill-labs/webmux/compare/v0.10.0...v0.10.1) (2026-03-10)


### Bug Fixes

* handle missing direnv binary in lifecycle hook runner ([#89](https://github.com/windmill-labs/webmux/issues/89)) ([d4f10d4](https://github.com/windmill-labs/webmux/commit/d4f10d4db8c7eab761dad562ba9385f774ebf287))

## [0.10.0](https://github.com/windmill-labs/webmux/compare/v0.9.0...v0.10.0) (2026-03-10)


### Features

* change default worktree root from __worktrees to ../worktrees ([dd4fbed](https://github.com/windmill-labs/webmux/commit/dd4fbed4bbb0daa4d30a6a302fe845ff8b36dcb3))
* inject .env.local into worktree runtime environment ([#86](https://github.com/windmill-labs/webmux/issues/86)) ([4d25f95](https://github.com/windmill-labs/webmux/commit/4d25f95d98fd6cc3d12ab525f733c8e87ee459c4))


### Bug Fixes

* probe both IPv4 and IPv6 in service port health check ([#87](https://github.com/windmill-labs/webmux/issues/87)) ([62eb812](https://github.com/windmill-labs/webmux/commit/62eb812d3d6b45be96fe5ac4b8b6f845e8551d5c))

## [0.9.0](https://github.com/windmill-labs/webmux/compare/v0.8.0...v0.9.0) (2026-03-10)


### Features

* add native webmux lifecycle commands ([#83](https://github.com/windmill-labs/webmux/issues/83)) ([41818f7](https://github.com/windmill-labs/webmux/commit/41818f7339b37620fd0e3b9d4c24d001bda3a011))
* add webmux list command and auto-attach tmux on add ([#85](https://github.com/windmill-labs/webmux/issues/85)) ([07c199d](https://github.com/windmill-labs/webmux/commit/07c199d87d77cad28f97c1b14513fce80edcc876))

## [0.8.0](https://github.com/windmill-labs/webmux/compare/v0.7.3...v0.8.0) (2026-03-10)


### Features

* enforce minimum bun version (&gt;= 1.3.5) during webmux init ([867ea63](https://github.com/windmill-labs/webmux/commit/867ea63c12fa637af5a75b63b709a294c8169f5a))


### Bug Fixes

* use direnv exec for lifecycle hooks to provide nix dev shell env ([#82](https://github.com/windmill-labs/webmux/issues/82)) ([3d0d2c5](https://github.com/windmill-labs/webmux/commit/3d0d2c516c9b634b0f670a84e0f0bb08fbca3dd8))

## [0.7.3](https://github.com/windmill-labs/webmux/compare/v0.7.2...v0.7.3) (2026-03-09)


### Bug Fixes

* avoid reopening removing worktrees ([cabbeac](https://github.com/windmill-labs/webmux/commit/cabbeac3df2af5d59b45d42b26efbee05cdcbf58))
* force remove worktrees from backend ([7e0f192](https://github.com/windmill-labs/webmux/commit/7e0f192d47e6034f94933475be0e06294f5eb26a))
* harden backend worktree removal ([a79e171](https://github.com/windmill-labs/webmux/commit/a79e1717d4fe3c2e7aec0160fcadcdbecc927c1d))
* run postcreate hook before tmux startup ([4ad6a73](https://github.com/windmill-labs/webmux/commit/4ad6a73f5fcb1dabc084073ca6b30897d97339aa))

## [0.7.2](https://github.com/windmill-labs/webmux/compare/v0.7.1...v0.7.2) (2026-03-06)


### Bug Fixes

* use python pty.spawn instead of script on macOS ([26aeeeb](https://github.com/windmill-labs/webmux/commit/26aeeeb3106a9c8e074be7ffefa6cd9606dadcff))

## [0.7.1](https://github.com/windmill-labs/webmux/compare/v0.7.0...v0.7.1) (2026-03-06)


### Bug Fixes

* use correct `script` command syntax on macOS ([4f3d5ef](https://github.com/windmill-labs/webmux/commit/4f3d5efd59e06810203bcbb7023cc06ecd2413b5))

## [0.7.0](https://github.com/windmill-labs/webmux/compare/v0.6.2...v0.7.0) (2026-03-04)


### Features

* generate .workmux.yaml with env-aware pane setup in init ([3cc608d](https://github.com/windmill-labs/webmux/commit/3cc608db4c4d19fbfc8e4307d35da0b602643094))
* uncomment services and add npm install in init templates ([2943df2](https://github.com/windmill-labs/webmux/commit/2943df27f3f360cdc339e3ea8753048e51c4c7da))


### Bug Fixes

* comment out services section in webmux template ([3967301](https://github.com/windmill-labs/webmux/commit/3967301fd4b6c2fe8b8b069b7e1b19991a86fdcb))

## [0.6.2](https://github.com/windmill-labs/webmux/compare/v0.6.1...v0.6.2) (2026-03-04)


### Performance

* reduce GitHub API usage by scoping PR polls to active worktrees ([5634a8e](https://github.com/windmill-labs/webmux/commit/5634a8e268f9aeaaba09f39667723bdc13254735))

## [0.6.1](https://github.com/windmill-labs/webmux/compare/v0.6.0...v0.6.1) (2026-03-04)


### Bug Fixes

* check for systemctl/launchctl before managing services ([61c9819](https://github.com/windmill-labs/webmux/commit/61c9819315202030b21d87f5e273dbdcbd2e39fd))

## [0.6.0](https://github.com/windmill-labs/webmux/compare/v0.5.0...v0.6.0) (2026-03-04)


### Features

* add `webmux init` onboarding command ([#65](https://github.com/windmill-labs/webmux/issues/65)) ([6e8b128](https://github.com/windmill-labs/webmux/commit/6e8b128785d716bf38cd1a3ea0d45f9837941ec3))
* add `webmux service` command for running as a system daemon ([#67](https://github.com/windmill-labs/webmux/issues/67)) ([39ba997](https://github.com/windmill-labs/webmux/commit/39ba99704482ea5bfb8567a632b741df3e6bb623))
* extract StartupEnvFields component ([#66](https://github.com/windmill-labs/webmux/issues/66)) ([6a2206d](https://github.com/windmill-labs/webmux/commit/6a2206d53183bcf5f307bb3d919aa6484caef55f))
* rate-limit mitigation for GitHub API calls ([#69](https://github.com/windmill-labs/webmux/issues/69)) ([efb4b4a](https://github.com/windmill-labs/webmux/commit/efb4b4a46154842e6ef5e13320f08710d2f76707))
* render checkbox for boolean startupEnvs, omit unchecked from env ([e274b3b](https://github.com/windmill-labs/webmux/commit/e274b3bc472e60748bd0d389aa08b2230e8918ac))


### Bug Fixes

* escape single quotes in .env.local values for bash sourcing ([#68](https://github.com/windmill-labs/webmux/issues/68)) ([e7022d7](https://github.com/windmill-labs/webmux/commit/e7022d7842ca11e68478679b6412615cd93465df))

## [0.5.0](https://github.com/windmill-labs/workmux-web/compare/v0.4.0...v0.5.0) (2026-03-03)


### Features

* add startup environment variables config ([#59](https://github.com/windmill-labs/workmux-web/issues/59)) ([7ee49f4](https://github.com/windmill-labs/workmux-web/commit/7ee49f46310b5356b35e0e1df68ced88855d74bc))
* show externally-created worktrees in UI ([#62](https://github.com/windmill-labs/workmux-web/issues/62)) ([5b3c8c2](https://github.com/windmill-labs/workmux-web/commit/5b3c8c2ad72bf7d48bd8b7861c3512e2317c9a51))
* support Shift+Enter for newline in terminal via tmux send-keys ([#63](https://github.com/windmill-labs/workmux-web/issues/63)) ([cf87fbe](https://github.com/windmill-labs/workmux-web/commit/cf87fbe50455039bcc6505393e75e5723afd55d0))


### Bug Fixes

* clean up orphaned tmux windows on worktree list poll ([#60](https://github.com/windmill-labs/workmux-web/issues/60)) ([c399d02](https://github.com/windmill-labs/workmux-web/commit/c399d02c5c0881fe8ef3e72171f3077f96fee485))

## [0.4.0](https://github.com/windmill-labs/workmux-web/compare/v0.3.0...v0.4.0) (2026-03-02)


### Features

* add fuzzy search, description preview, and clickable tiles to Linear panel ([#57](https://github.com/windmill-labs/workmux-web/issues/57)) ([b03be8a](https://github.com/windmill-labs/workmux-web/commit/b03be8a48c8c9164fda87095c89b01f67f658122))
* add name field to config for custom dashboard title ([#56](https://github.com/windmill-labs/workmux-web/issues/56)) ([0e7878c](https://github.com/windmill-labs/workmux-web/commit/0e7878c16db41f8d85e9a75386dde168e4758ef5))
* fetch and display GitHub PR inline review comments ([#55](https://github.com/windmill-labs/workmux-web/issues/55)) ([da5a9b2](https://github.com/windmill-labs/workmux-web/commit/da5a9b2db3fcb62ab8eee105d5d091faa0522388))


### Bug Fixes

* defer .env.local sourcing in pane commands to avoid port race condition ([#54](https://github.com/windmill-labs/workmux-web/issues/54)) ([d4e077f](https://github.com/windmill-labs/workmux-web/commit/d4e077f755d404fa825da5092cb6645bd6848ff6))
* single-quote PR_DATA in .env.local for shell safety ([#52](https://github.com/windmill-labs/workmux-web/issues/52)) ([70056d4](https://github.com/windmill-labs/workmux-web/commit/70056d4c24dfe34eab16067ad46c9a3a33ae9565))

## [0.3.0](https://github.com/windmill-labs/workmux-web/compare/v0.2.3...v0.3.0) (2026-03-02)


### Features

* add agent + lightning bolt SVG favicon ([0e5a099](https://github.com/windmill-labs/workmux-web/commit/0e5a09958d88b058bc7526333c774231815b85b6))
* read-only Linear integration ([#51](https://github.com/windmill-labs/workmux-web/issues/51)) ([6f11416](https://github.com/windmill-labs/workmux-web/commit/6f114168f8360c67e5d4dac4b540bb89cc94d872))
* real-time notification system for agent events ([#47](https://github.com/windmill-labs/workmux-web/issues/47)) ([c2fa730](https://github.com/windmill-labs/workmux-web/commit/c2fa730e76b4973afdc6eae3389f4a64379714f0))
* uncommitted changes indicator on TopBar ([#50](https://github.com/windmill-labs/workmux-web/issues/50)) ([413ec45](https://github.com/windmill-labs/workmux-web/commit/413ec45aff99bf11f299063f634b74acbd7eaf09))


### Bug Fixes

* graceful recovery when tmux dies during polling ([4073132](https://github.com/windmill-labs/workmux-web/commit/4073132d968167c95de69047f887859b525695ed))
* persist notification dot until worktree is focused ([#49](https://github.com/windmill-labs/workmux-web/issues/49)) ([f2ca3de](https://github.com/windmill-labs/workmux-web/commit/f2ca3de61cd07b74b6600c98898fa8073b5fd947))
* reduce notification toast auto-dismiss to 4 seconds ([10c0230](https://github.com/windmill-labs/workmux-web/commit/10c023079c9ecd29ba03cde6e43b1be5029780f5))
* resolve detached HEAD breaking worktree tmux lookup during rebase ([e6354b0](https://github.com/windmill-labs/workmux-web/commit/e6354b0a926d9c1eb8abd6263cdbc54a0dd0b6df))
* reuse removingBranches state for merge loading indicator ([56beed5](https://github.com/windmill-labs/workmux-web/commit/56beed57656655fb1cf8dfcb6ab2b2201a560b6e))


### Performance

* optimize backend polling, caching, and WebSocket throughput ([#43](https://github.com/windmill-labs/workmux-web/issues/43)) ([35bf00a](https://github.com/windmill-labs/workmux-web/commit/35bf00a850a036194cc91e48c6418f34a6ee31e5))

## [0.2.3](https://github.com/windmill-labs/workmux-web/compare/v0.2.2...v0.2.3) (2026-03-01)


### Bug Fixes

* mount ~/.codex by default instead of via extraMounts config ([ee081f3](https://github.com/windmill-labs/workmux-web/commit/ee081f3fcb7fdd7962a722679a38e613f75cfb01))

## [0.2.2](https://github.com/windmill-labs/workmux-web/compare/v0.2.1...v0.2.2) (2026-03-01)


### Bug Fixes

* bundle backend at publish time to resolve missing dependencies ([#40](https://github.com/windmill-labs/workmux-web/issues/40)) ([98eff32](https://github.com/windmill-labs/workmux-web/commit/98eff32320e0ed8b96676bd3542f5d66a6153f59))

## [0.2.1](https://github.com/windmill-labs/workmux-web/compare/v0.2.0...v0.2.1) (2026-03-01)


### Bug Fixes

* add setup-node step for npm publish auth ([ff41cb4](https://github.com/windmill-labs/workmux-web/commit/ff41cb45136dac06d8c1c4455ea6e50356303af2))

## [0.2.0](https://github.com/windmill-labs/workmux-web/compare/v0.1.0...v0.2.0) (2026-03-01)


### Features

* add debug log levels with --debug flag for webmux ([331ed1a](https://github.com/windmill-labs/workmux-web/commit/331ed1a0445869c2d187a872f61a532c52315227))
* move port allocation into webmux backend ([#34](https://github.com/windmill-labs/workmux-web/issues/34)) ([ade42fd](https://github.com/windmill-labs/workmux-web/commit/ade42fddecb27b350c548cc2c3146014ccf4b340))


### Bug Fixes

* add passwd entry for UID 1000 to fix "I have no name!" prompt ([#36](https://github.com/windmill-labs/workmux-web/issues/36)) ([9f8b871](https://github.com/windmill-labs/workmux-web/commit/9f8b871491574ca8f465027c88292132df4cbf46))
* correct repo URL to windmill-labs/workmux-web ([de35efe](https://github.com/windmill-labs/workmux-web/commit/de35efec763748bfa9dbb1b74c9ebb95ece278d0))
* replace autofocus attribute with use:action to resolve a11y warning ([cdf905d](https://github.com/windmill-labs/workmux-web/commit/cdf905d4730a9e8e7ea90265653d9329a6687175))
* terminal clipboard copy failing in non-secure contexts ([2a3a565](https://github.com/windmill-labs/workmux-web/commit/2a3a5655be81ad48da61f07140627ea4da2fbe7a))
