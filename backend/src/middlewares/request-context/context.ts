import { AsyncLocalStorage } from "async_hooks";

type ContextStore = Map<string, unknown>;

let currentContext: AsyncLocalStorage<ContextStore> | undefined;

export function context(): AsyncLocalStorage<ContextStore> {
  if (currentContext === undefined) {
    currentContext = new AsyncLocalStorage<ContextStore>();
  }

  return currentContext;
}
