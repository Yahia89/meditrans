import { createElement, use, type ComponentType } from 'react';

/** Share code preloading with rendering, including the fulfilled module value. */
export function preloadable<Props extends object>(importModule: () => Promise<{ default: ComponentType<Props> }>) {
  let resolved: ComponentType<Props> | undefined;
  let pending: Promise<{ default: ComponentType<Props> }> | undefined;
  let failure: { error: unknown } | undefined;
  const load = () => {
    if (!pending) {
      failure = undefined;
      pending = importModule().then(module => {
        resolved = module.default;
        return module;
      }, error => {
        pending = undefined;
        failure = { error };
        throw error;
      });
    }
    return pending;
  };
  // A route loader that awaited load() can render synchronously. Calling
  // React.lazy again with an already downloaded module still suspends on its
  // first render, delaying the page's queries behind another fallback cycle.
  const Component = (props: Props) => {
    // Only an explicit preload retry clears a failure; rendering must not loop.
    if (failure) throw failure.error;
    // `use` may be conditional and consumes our cached promise. Always render
    // the same component type so later session updates preserve open drafts.
    const Render = resolved ?? use(load()).default;
    return createElement(Render, props);
  };
  return Object.assign(load, { Component });
}
