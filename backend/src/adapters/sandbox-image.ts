/**
 * The default sandbox image, built locally on demand: no registry to publish
 * to. Its tag hashes the Dockerfile, so editing it yields a new image.
 */

/** Slim base with what agents and their installs need; agent CLIs themselves
 *  are installed at runtime into the shared tools volume. */
export const DEFAULT_SANDBOX_DOCKERFILE = `FROM debian:bookworm-slim
ENV LANG=C.UTF-8
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \\
 && apt-get install -y --no-install-recommends \\
    ca-certificates curl git gnupg sudo openssh-client unzip build-essential less procps \\
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
 && apt-get install -y --no-install-recommends nodejs \\
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \\
    -o /usr/share/keyrings/githubcli-archive-keyring.gpg \\
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \\
    > /etc/apt/sources.list.d/github-cli.list \\
 && apt-get update \\
 && apt-get install -y --no-install-recommends gh \\
 && rm -rf /var/lib/apt/lists/*
`;

export function defaultSandboxImageTag(dockerfile: string = DEFAULT_SANDBOX_DOCKERFILE): string {
  const hash = new Bun.CryptoHasher("sha256").update(dockerfile).digest("hex").slice(0, 12);
  return `webmux-sandbox:${hash}`;
}
