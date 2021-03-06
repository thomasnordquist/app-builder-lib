"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProjectInfoManager = void 0;

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

class ProjectInfoManager {
  constructor(packager) {
    this.packager = packager;
    this.infoFile = new (_lazyVal().Lazy)(() => this.saveConfigurationAndMetadata());
  }

  async saveConfigurationAndMetadata() {
    const packager = this.packager;
    const tempDir = await packager.tempDirManager.createTempDir({
      prefix: "remote-build-metadata"
    }); // we cannot use getTempFile because file name must be constant

    const info = {
      metadata: packager.metadata,
      configuration: packager.config,
      repositoryInfo: await packager.repositoryInfo,
      buildResourceDirName: path.basename(packager.buildResourcesDir)
    };

    if (packager.metadata !== packager.devMetadata && packager.devMetadata != null) {
      info.devMetadata = packager.devMetadata;
    }

    const file = path.join(tempDir, "info.json");
    await (0, _fsExtraP().outputJson)(file, info);
    return file;
  }

} exports.ProjectInfoManager = ProjectInfoManager;
// __ts-babel@6.0.4
//# sourceMappingURL=ProjectInfoManager.js.map