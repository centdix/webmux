export type ComponentProtocol = "http" | "https" | "tcp";

export interface ComponentTcpHealthCheck {
  type: "tcp";
}

export interface ComponentPortDefinition {
  name: string;
  processEnv: string;
  protocol: ComponentProtocol;
  health: ComponentTcpHealthCheck | null;
}

export interface ComponentDefinition {
  id: string;
  label: string;
  kind: string;
  workingDir: string;
  command: string;
  environment: Record<string, string>;
  ports: ComponentPortDefinition[];
}

export interface ComponentCatalogConfig {
  command: string;
}

export type ComponentCatalogState =
  | {
      status: "disabled";
      components: ComponentDefinition[];
      error: null;
    }
  | {
      status: "ready";
      components: ComponentDefinition[];
      error: null;
    }
  | {
      status: "error";
      components: ComponentDefinition[];
      error: string;
    };
