import { createElement, lazy, type ComponentType } from 'react';

/** Share code preloading with rendering, including the fulfilled module value. */
export function preloadable<Props extends object>(importModule: () => Promise<{ default: ComponentType<Props> }>) {
  let resolved: ComponentType<Props> | undefined;
  let pending: Promise<{ default: ComponentType<Props> }> | undefined;
  const load = () => pending ??= importModule().then(module => {
    resolved = module.default;
    return module;
  }, error => {
    pending = undefined;
    throw error;
  });
  const LazyComponent = lazy(load);
  // A route loader that awaited load() can render synchronously. Calling
  // React.lazy again with an already downloaded module still suspends on its
  // first render, delaying the page's queries behind another fallback cycle.
  const Component = (props: Props) => createElement(resolved ?? LazyComponent, props);
  return Object.assign(load, { Component });
}
