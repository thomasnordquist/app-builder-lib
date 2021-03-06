"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createLazyProductionDeps = createLazyProductionDeps;
exports.getProductionDependencies = getProductionDependencies;

function _bluebirdLst() {
  const data = _interopRequireDefault(require("bluebird-lst"));

  _bluebirdLst = function () {
    return data;
  };

  return data;
}

function _builderUtil() {
  const data = require("builder-util");

  _builderUtil = function () {
    return data;
  };

  return data;
}

function _fs() {
  const data = require("builder-util/out/fs");

  _fs = function () {
    return data;
  };

  return data;
}

function _promise() {
  const data = require("builder-util/out/promise");

  _promise = function () {
    return data;
  };

  return data;
}

function _fsExtraP() {
  const data = require("fs-extra-p");

  _fsExtraP = function () {
    return data;
  };

  return data;
}

function _lazyVal() {
  const data = require("lazy-val");

  _lazyVal = function () {
    return data;
  };

  return data;
}

var path = _interopRequireWildcard(require("path"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// noinspection SpellCheckingInspection
const knownAlwaysIgnoredDevDeps = new Set(["electron-builder-tslint-config", "electron-download", "libui-download", "electron-forge", "electron-packager", "electron-compilers", "prebuild-install", "nan", "electron-webpack", "electron-webpack-ts", "electron-webpack-vue", "@types"]); // noinspection JSUnusedGlobalSymbols

function createLazyProductionDeps(projectDir) {
  return new (_lazyVal().Lazy)(() => getProductionDependencies(projectDir));
}
/** @internal */


async function getProductionDependencies(folder) {
  const result = [];
  computeSortedPaths((await new Collector().collect(folder)), result, false);
  return result;
}

const ignoredProperties = new Set(["description", "author", "bugs", "engines", "repository", "build", "main", "license", "homepage", "scripts", "maintainers", "contributors", "keywords", "devDependencies", "files", "typings", "types", "xo", "resolutions"]);

function readJson(file) {
  return (0, _fsExtraP().readFile)(file, "utf-8").then(it => JSON.parse(it, (key, value) => ignoredProperties.has(key) ? undefined : value));
}

function computeSortedPaths(parent, result, isExtraneous) {
  const dependencies = parent.dependencies;

  if (dependencies == null) {
    return;
  }

  for (const dep of dependencies.values()) {
    if (dep.extraneous === isExtraneous) {
      result.push(dep);
      computeSortedPaths(dep, result, isExtraneous);
    }
  }
}

class Collector {
  constructor() {
    this.pathToMetadata = new Map();
    this.unresolved = new Map();
  }

  async collect(dir) {
    const rootDependency = await readJson(path.join(dir, "package.json"));
    await this.readInstalled(path.join(dir, "node_modules"), rootDependency, rootDependency.name);
    this.unmarkExtraneous(rootDependency);

    if (this.unresolved.size > 0) {
      _builderUtil().log.debug({
        unresolved: Array.from(this.unresolved.keys()).join(", ")
      }, "unresolved dependencies after first round");

      await this.resolveUnresolvedHoisted(rootDependency, dir);
    }

    return rootDependency;
  }

  async resolveUnresolvedHoisted(rootDependency, dir) {
    let nameToMetadata = rootDependency.dependencies;

    if (nameToMetadata == null) {
      rootDependency.dependencies = new Map();
      nameToMetadata = rootDependency.dependencies;
    }

    let parentDir = dir;

    do {
      parentDir = path.dirname(parentDir);

      if (parentDir === "" || parentDir.endsWith("/") || parentDir.endsWith("\\")) {
        // https://github.com/electron-userland/electron-builder/issues/2220
        const list = Array.from(this.unresolved.keys()).filter(it => !this.unresolved.get(it));

        if (list.length === 1 && list[0] === "proton-native") {
          // resolve in tests
          parentDir = process.cwd();
        } else {
          if (list.length !== 0) {
            const message = `Unresolved node modules: ${list.join(", ")}`;

            if ((0, _builderUtil().isEnvTrue)(process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES)) {
              _builderUtil().log.warn(message);
            } else {
              throw new Error(message);
            }
          }

          break;
        }
      }

      const parentNodeModulesDir = parentDir + path.sep + "node_modules";
      const dirStat = await (0, _fs().statOrNull)(parentNodeModulesDir);

      if (dirStat == null || !dirStat.isDirectory()) {
        if (dirStat == null || !dirStat.isDirectory()) {
          continue;
        }
      } // https://github.com/electron-userland/electron-builder/issues/2222#issuecomment-339060335
      // step 1: resolve current unresolved
      // step n: try to resolve new unresolved in the same parent dir until at least something is resolved in the dir


      while (true) {
        const unresolved = Array.from(this.unresolved.keys());
        this.unresolved.clear();
        const resolved = await _bluebirdLst().default.map(unresolved, it => {
          return this.readChildPackage(it, parentNodeModulesDir, rootDependency).catch(e => {
            if (e.code === "ENOENT") {
              return null;
            } else {
              throw e;
            }
          });
        }, _fs().CONCURRENCY);
        let hasResolved = false;

        for (const dep of resolved) {
          if (dep != null) {
            hasResolved = true;
            this.unmarkExtraneous(dep);
            nameToMetadata.set(dep.realName, dep);
          }
        }

        if (!hasResolved) {
          break;
        }

        this.unmarkExtraneous(rootDependency);

        if (this.unresolved.size === 0) {
          return;
        }
      }
    } while (this.unresolved.size > 0);
  }

  async readInstalled(nodeModulesDir, dependency, name) {
    dependency.realName = name;
    dependency.directDependencyNames = dependency.dependencies == null ? null : Object.keys(dependency.dependencies); // mark as extraneous at this point.
    // this will be un-marked in unmarkExtraneous, where we mark as not-extraneous everything that is required in some way from the root object.

    dependency.extraneous = true;
    dependency.optional = true;

    if (dependency.dependencies == null && dependency.optionalDependencies == null) {
      // package has only dev or peer dependencies - no need to check child node_module
      dependency.dependencies = null;
      return;
    }

    const childModules = await readNodeModulesDir(nodeModulesDir);

    if (childModules == null) {
      dependency.dependencies = null;
      return;
    }

    const deps = await _bluebirdLst().default.map(childModules, it => this.readChildPackage(it, nodeModulesDir, dependency), _fs().CONCURRENCY);

    if (deps.length === 0) {
      dependency.dependencies = null;
      return;
    }

    const nameToMetadata = new Map();

    for (const dep of deps) {
      if (dep != null) {
        nameToMetadata.set(dep.realName, dep);
      }
    }

    dependency.dependencies = nameToMetadata;
  }

  async readChildPackage(name, nodeModulesDir, parent) {
    const rawDir = path.join(nodeModulesDir, name);
    let dir = rawDir;
    const stat = await (0, _fsExtraP().lstat)(dir);
    const isSymbolicLink = stat.isSymbolicLink();

    if (isSymbolicLink) {
      dir = await (0, _promise().orNullIfFileNotExist)((0, _fsExtraP().realpath)(dir));

      if (dir == null) {
        _builderUtil().log.debug({
          path: rawDir
        }, "broken symlink");

        return null;
      }
    }

    const processed = this.pathToMetadata.get(dir);

    if (processed != null) {
      return processed;
    }

    const metadata = await (0, _promise().orNullIfFileNotExist)(readJson(path.join(dir, "package.json")));

    if (metadata == null) {
      return null;
    }

    if (isSymbolicLink) {
      metadata.link = dir;
      metadata.stat = stat;
    } else {
      metadata.parent = parent; // overwrite if already set by project package.json

      metadata.link = undefined;
    }

    metadata.path = rawDir; // do not add root project to result

    this.pathToMetadata.set(dir, metadata);
    await this.readInstalled(dir + path.sep + "node_modules", metadata, name);
    return metadata;
  }

  unmark(deps, obj, unsetOptional, isOptional) {
    for (const name of deps) {
      const dep = this.findDep(obj, name, isOptional);

      if (dep != null) {
        if (unsetOptional) {
          dep.optional = false;
        }

        if (dep.extraneous) {
          this.unmarkExtraneous(dep);
        }
      }
    }
  }

  unmarkExtraneous(obj) {
    // Mark all non-required deps as extraneous.
    // start from the root object and mark as non-extraneous all modules
    // that haven't been previously flagged as extraneous then propagate to all their dependencies
    obj.extraneous = false;

    if (obj.directDependencyNames != null) {
      this.unmark(obj.directDependencyNames, obj, true, false);
    }

    if (obj.peerDependencies != null) {
      this.unmark(Object.keys(obj.peerDependencies), obj, true, false);
    }

    if (obj.optionalDependencies != null) {
      this.unmark(Object.keys(obj.optionalDependencies), obj, false, true);
    }
  } // find the one that will actually be loaded by require() so we can make sure it's valid


  findDep(obj, name, isOptional) {
    if (isIgnoredDep(name)) {
      return null;
    }

    let r = obj;
    let found = null;

    while (r != null && found == null) {
      // if r is a valid choice, then use that.
      // kinda weird if a pkg depends on itself, but after the first iteration of this loop, it indicates a dep cycle.
      found = r.dependencies == null ? null : r.dependencies.get(name);

      if (found == null && r.realName === name) {
        found = r;
      }

      r = r.link == null ? r.parent : null;
    }

    if (found == null) {
      this.unresolved.set(name, isOptional);
    }

    return found;
  }

}

function isIgnoredDep(name) {
  return knownAlwaysIgnoredDevDeps.has(name) || name.startsWith("@types/");
}

async function readNodeModulesDir(dir) {
  let files;

  try {
    files = (await (0, _fsExtraP().readdir)(dir)).filter(it => !it.startsWith(".") && !knownAlwaysIgnoredDevDeps.has(it));
  } catch (e) {
    // error indicates that nothing is installed here
    return null;
  }

  files.sort();
  const scopes = files.filter(it => it.startsWith("@"));

  if (scopes.length === 0) {
    return files;
  }

  const result = files.filter(it => !it.startsWith("@"));
  const scopeFileList = await _bluebirdLst().default.map(scopes, it => (0, _fsExtraP().readdir)(path.join(dir, it)));

  for (let i = 0; i < scopes.length; i++) {
    const list = scopeFileList[i];
    list.sort();

    for (const file of list) {
      if (!file.startsWith(".")) {
        result.push(`${scopes[i]}/${file}`);
      }
    }
  }

  return result;
} 
// __ts-babel@6.0.4
//# sourceMappingURL=packageDependencies.js.map