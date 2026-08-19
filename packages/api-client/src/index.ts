import type { Task } from "@pulse/domain";

export interface PulseApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
}

export class PulseApiClient {
  constructor(private readonly options: PulseApiClientOptions) {}

  async listTasks(): Promise<Task[]> {
    const token = await this.options.getAccessToken?.();
    const response = await fetch(`${this.options.baseUrl}/api/tasks`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error(`Pulse API error: ${response.status}`);
    return response.json() as Promise<Task[]>;
  }
}
