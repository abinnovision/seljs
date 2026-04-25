# Changelog

## [1.3.0](https://github.com/abinnovision/seljs/compare/checker-v1.2.0...checker-v1.3.0) (2026-04-25)


### Features

* add balance() address accessor and integrate with Multicall3 ([#45](https://github.com/abinnovision/seljs/issues/45)) ([1c64d7c](https://github.com/abinnovision/seljs/commit/1c64d7ca1fdf32f9b9a909710b8131e46b3ee884))
* hexBytes/keccak256 CEL builtins and sel.ZERO_BYTES32 ([#82](https://github.com/abinnovision/seljs/issues/82)) ([cf60316](https://github.com/abinnovision/seljs/commit/cf603169f1774cc506260471129daa6ee8a6ebd0))
* list&lt;sol_int&gt;.sum() / min() / max() receiver builtins ([#84](https://github.com/abinnovision/seljs/issues/84)) ([f76fe6a](https://github.com/abinnovision/seljs/commit/f76fe6a1f9883dc0010756890dca461e3f2ed463))
* register int &lt;op&gt; sol_int arithmetic overloads ([#81](https://github.com/abinnovision/seljs/issues/81)) ([22b66f8](https://github.com/abinnovision/seljs/commit/22b66f8fed6ea20dbe765aa75c7d8170078b8e0e))
* sol_int decimals overloads + EVM constants (WAD, RAY, Q96, Q128, MAX_UINT256) ([#80](https://github.com/abinnovision/seljs/issues/80)) ([46a1218](https://github.com/abinnovision/seljs/commit/46a12184c7ab798951993dde79ca4e487e026a12))
* structured SEL error hierarchy with static/runtime split ([#86](https://github.com/abinnovision/seljs/issues/86)) ([ab88b2c](https://github.com/abinnovision/seljs/commit/ab88b2cbf52fe5d236fd2ae099030d8558783eec))


### Bug Fixes

* throw SELEvaluationError from CEL builtins instead of plain Error ([#83](https://github.com/abinnovision/seljs/issues/83)) ([0a981af](https://github.com/abinnovision/seljs/commit/0a981af4479a1007fa34cd42f87a742f6646df6e))

## [1.2.0](https://github.com/abinnovision/seljs/compare/checker-v1.1.0...checker-v1.2.0) (2026-03-21)


### Features

* unify limits with linter rule ([#38](https://github.com/abinnovision/seljs/issues/38)) ([993dd1e](https://github.com/abinnovision/seljs/commit/993dd1e29f5d6d50a4c9a4671ab1b009169215fa))

## [1.1.0](https://github.com/abinnovision/seljs/compare/checker-v1.0.1...checker-v1.1.0) (2026-03-18)


### Bug Fixes

* enhance error diagnostics for multi-line expressions ([#36](https://github.com/abinnovision/seljs/issues/36)) ([7237078](https://github.com/abinnovision/seljs/commit/7237078dc2a6e64ef57cee169ddee7dfae8bede9))

## [1.0.1](https://github.com/abinnovision/seljs/compare/checker-v1.0.0...checker-v1.0.1) (2026-03-16)


### Bug Fixes

* export esm and cjs ([#23](https://github.com/abinnovision/seljs/issues/23)) ([23d525d](https://github.com/abinnovision/seljs/commit/23d525d9084d18a370d4c6307b983a857a865f59))

## 1.0.0 (2026-03-13)


### Features

* first implementation of seljs ([7548fe0](https://github.com/abinnovision/seljs/commit/7548fe06cbb22ec6b74b20e38ef07d026b3f8def))
