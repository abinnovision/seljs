# Changelog

## [1.4.1](https://github.com/abinnovision/seljs/compare/runtime-v1.4.0...runtime-v1.4.1) (2026-10-01)


### Bug Fixes

* **deps:** bump patch/minor production dependencies ([#130](https://github.com/abinnovision/seljs/issues/130)) ([6c1e05f](https://github.com/abinnovision/seljs/commit/6c1e05f6197c1bf0063ced50b32ab26f32fc13d9))
* **deps:** bump the production-dependencies group across 1 directory with 2 updates ([#141](https://github.com/abinnovision/seljs/issues/141)) ([c379c9e](https://github.com/abinnovision/seljs/commit/c379c9e6aaeab496592e6a56fa36fc70d4279538))
* **deps:** bump the production-dependencies group across 1 directory with 2 updates ([#156](https://github.com/abinnovision/seljs/issues/156)) ([7718595](https://github.com/abinnovision/seljs/commit/771859553aa358e88cbb44cdde02b9ab8cf261da))
* **deps:** bump the production-dependencies group across 1 directory with 4 updates ([#190](https://github.com/abinnovision/seljs/issues/190)) ([bd4463e](https://github.com/abinnovision/seljs/commit/bd4463e900192bc7f6a71b465ffe7d107a5aaf9f))
* **deps:** bump the production-dependencies group across 1 directory with 5 updates ([#149](https://github.com/abinnovision/seljs/issues/149)) ([91ad954](https://github.com/abinnovision/seljs/commit/91ad954f70e428a1a1abca3d5873f65eb2b6a80a))
* **deps:** bump the production-dependencies group across 1 directory with 5 updates ([#167](https://github.com/abinnovision/seljs/issues/167)) ([96bed22](https://github.com/abinnovision/seljs/commit/96bed22af0926992129ea6fb7f0deccf4a6944a9))
* **deps:** bump the production-dependencies group across 1 directory with 5 updates ([#179](https://github.com/abinnovision/seljs/issues/179)) ([2dd7070](https://github.com/abinnovision/seljs/commit/2dd7070888a694dc760a6a56cd584f3743cb1813))
* **deps:** bump the production-dependencies group across 1 directory with 5 updates ([#185](https://github.com/abinnovision/seljs/issues/185)) ([6bc8648](https://github.com/abinnovision/seljs/commit/6bc8648ba337a6983dea8a0aadb112872dcec549))
* **deps:** bump the production-dependencies group with 2 updates ([#133](https://github.com/abinnovision/seljs/issues/133)) ([741efa7](https://github.com/abinnovision/seljs/commit/741efa756bf43a66171c98642a3ed08f86c8c9c2))
* **deps:** bump the production-dependencies group with 2 updates ([#134](https://github.com/abinnovision/seljs/issues/134)) ([a75f72b](https://github.com/abinnovision/seljs/commit/a75f72b783b70a3d990e1f381c83caefb0c61052))
* **deps:** bump the production-dependencies group with 2 updates ([#135](https://github.com/abinnovision/seljs/issues/135)) ([b1766bc](https://github.com/abinnovision/seljs/commit/b1766bc42a28e0e7ea4ad37f4c8d57cc866b3271))
* **deps:** bump the production-dependencies group with 2 updates ([#151](https://github.com/abinnovision/seljs/issues/151)) ([d01110b](https://github.com/abinnovision/seljs/commit/d01110bbb7dc5541e0729bfc77ca1a861b42117a))
* **deps:** bump the production-dependencies group with 3 updates ([#181](https://github.com/abinnovision/seljs/issues/181)) ([a13b149](https://github.com/abinnovision/seljs/commit/a13b149e703c61b36c4376cc79dc45c9ee3035b9))
* **deps:** bump the production-dependencies group with 4 updates ([#136](https://github.com/abinnovision/seljs/issues/136)) ([ba202e0](https://github.com/abinnovision/seljs/commit/ba202e0f79b30310077425db74d0a4649d59a4b9))

## [1.4.0](https://github.com/abinnovision/seljs/compare/runtime-v1.3.0...runtime-v1.4.0) (2026-08-04)


### Features

* add balance() address accessor and integrate with Multicall3 ([#45](https://github.com/abinnovision/seljs/issues/45)) ([1c64d7c](https://github.com/abinnovision/seljs/commit/1c64d7ca1fdf32f9b9a909710b8131e46b3ee884))
* add type information to evaluation results ([#53](https://github.com/abinnovision/seljs/issues/53)) ([b1cd09f](https://github.com/abinnovision/seljs/commit/b1cd09f94b23c2841332b9ccc6c931ea6f88db32))
* decode multicall revert reasons onto SELContractError ([#85](https://github.com/abinnovision/seljs/issues/85)) ([2cc6745](https://github.com/abinnovision/seljs/commit/2cc6745634660de812092fcf63c6a8e383edf40b))
* first implementation of seljs ([7548fe0](https://github.com/abinnovision/seljs/commit/7548fe06cbb22ec6b74b20e38ef07d026b3f8def))
* implement SELClient interface and validation logic ([#44](https://github.com/abinnovision/seljs/issues/44)) ([2a57c1d](https://github.com/abinnovision/seljs/commit/2a57c1df8f0b5285e165a8cd56fc7a2fdca1c0b2))
* list&lt;sol_int&gt;.sum() / min() / max() receiver builtins ([#84](https://github.com/abinnovision/seljs/issues/84)) ([f76fe6a](https://github.com/abinnovision/seljs/commit/f76fe6a1f9883dc0010756890dca461e3f2ed463))
* make SELChecker the single validation gate in evaluate ([#69](https://github.com/abinnovision/seljs/issues/69)) ([b279a19](https://github.com/abinnovision/seljs/commit/b279a1971ff8dc64799c231aa41392619dbadacb))
* structured SEL error hierarchy with static/runtime split ([#86](https://github.com/abinnovision/seljs/issues/86)) ([ab88b2c](https://github.com/abinnovision/seljs/commit/ab88b2cbf52fe5d236fd2ae099030d8558783eec))
* unify limits with linter rule ([#38](https://github.com/abinnovision/seljs/issues/38)) ([993dd1e](https://github.com/abinnovision/seljs/commit/993dd1e29f5d6d50a4c9a4671ab1b009169215fa))


### Bug Fixes

* adjust type definition for promise return value ([#54](https://github.com/abinnovision/seljs/issues/54)) ([009d456](https://github.com/abinnovision/seljs/commit/009d4560d3d1eae62851c7ab287166ec048d23c8))
* decode revert reasons on direct-call path and surface cause ([#88](https://github.com/abinnovision/seljs/issues/88)) ([fc356b6](https://github.com/abinnovision/seljs/commit/fc356b66c861817cc481d45ac34e50b83e3d0d1c))
* export esm and cjs ([#23](https://github.com/abinnovision/seljs/issues/23)) ([23d525d](https://github.com/abinnovision/seljs/commit/23d525d9084d18a370d4c6307b983a857a865f59))
* throw SELEvaluationError from CEL builtins instead of plain Error ([#83](https://github.com/abinnovision/seljs/issues/83)) ([0a981af](https://github.com/abinnovision/seljs/commit/0a981af4479a1007fa34cd42f87a742f6646df6e))
* upgrade typescript to v6.0.3 ([#126](https://github.com/abinnovision/seljs/issues/126)) ([8602f47](https://github.com/abinnovision/seljs/commit/8602f47edaa60ee76022e175812cb22999e6245d))

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
