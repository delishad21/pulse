import type { PulseRepository } from "./types.js";

let repository: PulseRepository | undefined;

export function setRepository(repo: PulseRepository): void {
  repository = repo;
}

export function getRepository(): PulseRepository {
  if (!repository) {
    throw new Error("Repository not initialized. Call setRepository() before use.");
  }
  return repository;
}

export function clearRepository(): void {
  repository = undefined;
}
