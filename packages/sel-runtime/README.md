# sel-core

Runtime execution engine. Evaluates SEL expressions against live contract data with full 256-bit precision. Handles contract calling, value wrapping/unwrapping, and multi-round dependency resolution.

Every chain read of an evaluation, including live calls inside comprehensions, `.balance()`, and the builtin `block.number` / `block.timestamp`, observes one pinned block. `meta.deferredCalls` counts the live calls that could not be batched. See the root README for `block`, contract `.address`, and `solInt(bytes)`.

Depends on all other SEL packages.
