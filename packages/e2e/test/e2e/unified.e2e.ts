import * as fixtures from "./fixtures/index.js";
import { runFixtureGroups } from "./runner.js";

runFixtureGroups(Object.values(fixtures));
