# Changelog

## [1.3.0](https://github.com/abinnovision/seljs/compare/runtime-v1.2.0...runtime-v1.3.0) (2026-04-25)


### Features

* add balance() address accessor and integrate with Multicall3 ([#45](https://github.com/abinnovision/seljs/issues/45)) ([1c64d7c](https://github.com/abinnovision/seljs/commit/1c64d7ca1fdf32f9b9a909710b8131e46b3ee884))
* add type information to evaluation results ([#53](https://github.com/abinnovision/seljs/issues/53)) ([b1cd09f](https://github.com/abinnovision/seljs/commit/b1cd09f94b23c2841332b9ccc6c931ea6f88db32))
* decode multicall revert reasons onto SELContractError ([#85](https://github.com/abinnovision/seljs/issues/85)) ([2cc6745](https://github.com/abinnovision/seljs/commit/2cc6745634660de812092fcf63c6a8e383edf40b))
* implement SELClient interface and validation logic ([#44](https://github.com/abinnovision/seljs/issues/44)) ([2a57c1d](https://github.com/abinnovision/seljs/commit/2a57c1df8f0b5285e165a8cd56fc7a2fdca1c0b2))
* list&lt;sol_int&gt;.sum() / min() / max() receiver builtins ([#84](https://github.com/abinnovision/seljs/issues/84)) ([f76fe6a](https://github.com/abinnovision/seljs/commit/f76fe6a1f9883dc0010756890dca461e3f2ed463))
* make SELChecker the single validation gate in evaluate ([#69](https://github.com/abinnovision/seljs/issues/69)) ([b279a19](https://github.com/abinnovision/seljs/commit/b279a1971ff8dc64799c231aa41392619dbadacb))
* structured SEL error hierarchy with static/runtime split ([#86](https://github.com/abinnovision/seljs/issues/86)) ([ab88b2c](https://github.com/abinnovision/seljs/commit/ab88b2cbf52fe5d236fd2ae099030d8558783eec))


### Bug Fixes

* adjust type definition for promise return value ([#54](https://github.com/abinnovision/seljs/issues/54)) ([009d456](https://github.com/abinnovision/seljs/commit/009d4560d3d1eae62851c7ab287166ec048d23c8))
* decode revert reasons on direct-call path and surface cause ([#88](https://github.com/abinnovision/seljs/issues/88)) ([fc356b6](https://github.com/abinnovision/seljs/commit/fc356b66c861817cc481d45ac34e50b83e3d0d1c))
* throw SELEvaluationError from CEL builtins instead of plain Error ([#83](https://github.com/abinnovision/seljs/issues/83)) ([0a981af](https://github.com/abinnovision/seljs/commit/0a981af4479a1007fa34cd42f87a742f6646df6e))

## [1.2.0](https://github.com/abinnovision/seljs/compare/runtime-v1.1.0...runtime-v1.2.0) (2026-03-21)


### Features

* unify limits with linter rule ([#38](https://github.com/abinnovision/seljs/issues/38)) ([993dd1e](https://github.com/abinnovision/seljs/commit/993dd1e29f5d6d50a4c9a4671ab1b009169215fa))

## [1.1.0](https://github.com/abinnovision/seljs/compare/runtime-v1.0.1...runtime-v1.1.0) (2026-03-18)


### Miscellaneous Chores

* **runtime:** Synchronize sel versions

## [1.0.1](https://github.com/abinnovision/seljs/compare/runtime-v1.0.0...runtime-v1.0.1) (2026-03-16)


### Bug Fixes

* export esm and cjs ([#23](https://github.com/abinnovision/seljs/issues/23)) ([23d525d](https://github.com/abinnovision/seljs/commit/23d525d9084d18a370d4c6307b983a857a865f59))

## 1.0.0 (2026-03-13)


### Features

* first implementation of seljs ([7548fe0](https://github.com/abinnovision/seljs/commit/7548fe06cbb22ec6b74b20e38ef07d026b3f8def))
