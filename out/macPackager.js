"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _builderUtil() {
  const data = require("builder-util");

  _builderUtil = function () {
    return data;
  };

  return data;
}

function _electronOsxSign() {
  const data = require("electron-osx-sign");

  _electronOsxSign = function () {
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

function _fs() {
  const data = require("builder-util/out/fs");

  _fs = function () {
    return data;
  };

  return data;
}

function _appInfo() {
  const data = require("./appInfo");

  _appInfo = function () {
    return data;
  };

  return data;
}

function _macCodeSign() {
  const data = require("./codeSign/macCodeSign");

  _macCodeSign = function () {
    return data;
  };

  return data;
}

function _core() {
  const data = require("./core");

  _core = function () {
    return data;
  };

  return data;
}

function _platformPackager() {
  const data = require("./platformPackager");

  _platformPackager = function () {
    return data;
  };

  return data;
}

function _ArchiveTarget() {
  const data = require("./targets/ArchiveTarget");

  _ArchiveTarget = function () {
    return data;
  };

  return data;
}

function _pkg() {
  const data = require("./targets/pkg");

  _pkg = function () {
    return data;
  };

  return data;
}

function _targetFactory() {
  const data = require("./targets/targetFactory");

  _targetFactory = function () {
    return data;
  };

  return data;
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

class MacPackager extends _platformPackager().PlatformPackager {
  constructor(info) {
    super(info, _core().Platform.MAC);
    this.codeSigningInfo = new (_lazyVal().Lazy)(() => {
      const cscLink = this.getCscLink();

      if (cscLink == null || process.platform !== "darwin") {
        return Promise.resolve({
          keychainName: process.env.CSC_KEYCHAIN || null
        });
      }

      return (0, _macCodeSign().createKeychain)({
        tmpDir: this.info.tempDirManager,
        cscLink,
        cscKeyPassword: this.getCscPassword(),
        cscILink: (0, _platformPackager().chooseNotNull)(this.platformSpecificBuildOptions.cscInstallerLink, process.env.CSC_INSTALLER_LINK),
        cscIKeyPassword: (0, _platformPackager().chooseNotNull)(this.platformSpecificBuildOptions.cscInstallerKeyPassword, process.env.CSC_INSTALLER_KEY_PASSWORD),
        currentDir: this.projectDir
      });
    });
    this._iconPath = new (_lazyVal().Lazy)(() => this.getOrConvertIcon("icns"));
  }

  get defaultTarget() {
    return this.info.framework.macOsDefaultTargets;
  }

  prepareAppInfo(appInfo) {
    return new (_appInfo().AppInfo)(this.info, this.platformSpecificBuildOptions.bundleVersion, this.platformSpecificBuildOptions);
  }

  async getIconPath() {
    return this._iconPath.value;
  }

  createTargets(targets, mapper) {
    for (const name of targets) {
      switch (name) {
        case _core().DIR_TARGET:
          break;

        case "dmg":
          const {
            DmgTarget
          } = require("dmg-builder");

          mapper(name, outDir => new DmgTarget(this, outDir));
          break;

        case "zip":
          // https://github.com/electron-userland/electron-builder/issues/2313
          mapper(name, outDir => new (_ArchiveTarget().ArchiveTarget)(name, outDir, this, true));
          break;

        case "pkg":
          mapper(name, outDir => new (_pkg().PkgTarget)(this, outDir));
          break;

        default:
          mapper(name, outDir => name === "mas" || name === "mas-dev" ? new (_targetFactory().NoOpTarget)(name) : (0, _targetFactory().createCommonTarget)(name, outDir, this));
          break;
      }
    }
  }

  async pack(outDir, arch, targets, taskManager) {
    let nonMasPromise = null;
    const hasMas = targets.length !== 0 && targets.some(it => it.name === "mas" || it.name === "mas-dev");
    const prepackaged = this.packagerOptions.prepackaged;

    if (!hasMas || targets.length > 1) {
      const appPath = prepackaged == null ? path.join(this.computeAppOutDir(outDir, arch), `${this.appInfo.productFilename}.app`) : prepackaged;
      nonMasPromise = (prepackaged ? Promise.resolve() : this.doPack(outDir, path.dirname(appPath), this.platform.nodeName, arch, this.platformSpecificBuildOptions, targets)).then(() => this.sign(appPath, null, null)).then(() => this.packageInDistributableFormat(appPath, _builderUtil().Arch.x64, targets, taskManager));
    }

    for (const target of targets) {
      const targetName = target.name;

      if (!(targetName === "mas" || targetName === "mas-dev")) {
        continue;
      }

      const masBuildOptions = (0, _builderUtil().deepAssign)({}, this.platformSpecificBuildOptions, this.config.mas);

      if (targetName === "mas-dev") {
        (0, _builderUtil().deepAssign)(masBuildOptions, this.config[targetName], {
          type: "development"
        });
      }

      const targetOutDir = path.join(outDir, targetName);

      if (prepackaged == null) {
        await this.doPack(outDir, targetOutDir, "mas", arch, masBuildOptions, [target]);
        await this.sign(path.join(targetOutDir, `${this.appInfo.productFilename}.app`), targetOutDir, masBuildOptions);
      } else {
        await this.sign(prepackaged, targetOutDir, masBuildOptions);
      }
    }

    if (nonMasPromise != null) {
      await nonMasPromise;
    }
  }

  async sign(appPath, outDir, masOptions) {
    if (!(0, _macCodeSign().isSignAllowed)()) {
      return;
    }

    const isMas = masOptions != null;
    const macOptions = this.platformSpecificBuildOptions;
    const qualifier = (isMas ? masOptions.identity : null) || macOptions.identity;

    if (!isMas && qualifier === null) {
      if (this.forceCodeSigning) {
        throw new (_builderUtil().InvalidConfigurationError)("identity explicitly is set to null, but forceCodeSigning is set to true");
      }

      _builderUtil().log.info({
        reason: "identity explicitly is set to null"
      }, "skipped macOS code signing");

      return;
    }

    const keychainName = (await this.codeSigningInfo.value).keychainName;
    const explicitType = isMas ? masOptions.type : macOptions.type;
    const type = explicitType || "distribution";
    const isDevelopment = type === "development";
    const certificateType = getCertificateType(isMas, isDevelopment);
    let identity = await (0, _macCodeSign().findIdentity)(certificateType, qualifier, keychainName);

    if (identity == null) {
      if (!isMas && !isDevelopment && explicitType !== "distribution") {
        identity = await (0, _macCodeSign().findIdentity)("Mac Developer", qualifier, keychainName);

        if (identity != null) {
          _builderUtil().log.warn("Mac Developer is used to sign app — it is only for development and testing, not for production");
        }
      }

      if (identity == null) {
        await (0, _macCodeSign().reportError)(isMas, certificateType, qualifier, keychainName, this.forceCodeSigning);
        return;
      }
    }

    const signOptions = {
      "identity-validation": false,
      // https://github.com/electron-userland/electron-builder/issues/1699
      // kext are signed by the chipset manufacturers. You need a special certificate (only available on request) from Apple to be able to sign kext.
      ignore: file => {
        return file.endsWith(".kext") || file.startsWith("/Contents/PlugIns", appPath.length) || // https://github.com/electron-userland/electron-builder/issues/2010
        file.includes("/node_modules/puppeteer/.local-chromium");
      },
      identity: identity,
      type,
      platform: isMas ? "mas" : "darwin",
      version: this.config.electronVersion,
      app: appPath,
      keychain: keychainName || undefined,
      binaries: (isMas && masOptions != null ? masOptions.binaries : macOptions.binaries) || undefined,
      requirements: isMas || macOptions.requirements == null ? undefined : await this.getResource(macOptions.requirements),
      "gatekeeper-assess": _macCodeSign().appleCertificatePrefixes.find(it => identity.name.startsWith(it)) != null
    };
    await this.adjustSignOptions(signOptions, masOptions);

    _builderUtil().log.info({
      file: _builderUtil().log.filePath(appPath),
      identityName: identity.name,
      identityHash: identity.hash,
      provisioningProfile: signOptions["provisioning-profile"] || "none"
    }, "signing");

    await this.doSign(signOptions); // https://github.com/electron-userland/electron-builder/issues/1196#issuecomment-312310209

    if (masOptions != null && !isDevelopment) {
      const certType = isDevelopment ? "Mac Developer" : "3rd Party Mac Developer Installer";
      const masInstallerIdentity = await (0, _macCodeSign().findIdentity)(certType, masOptions.identity, keychainName);

      if (masInstallerIdentity == null) {
        throw new (_builderUtil().InvalidConfigurationError)(`Cannot find valid "${certType}" identity to sign MAS installer, please see https://electron.build/code-signing`);
      } // mas uploaded to AppStore, so, use "-" instead of space for name


      const artifactName = this.expandArtifactNamePattern(masOptions, "pkg");
      const artifactPath = path.join(outDir, artifactName);
      await this.doFlat(appPath, artifactPath, masInstallerIdentity, keychainName);
      await this.dispatchArtifactCreated(artifactPath, null, _builderUtil().Arch.x64, this.computeSafeArtifactName(artifactName, "pkg"));
    }
  }

  async adjustSignOptions(signOptions, masOptions) {
    const resourceList = await this.resourceList;

    if (resourceList.includes(`entitlements.osx.plist`)) {
      throw new (_builderUtil().InvalidConfigurationError)("entitlements.osx.plist is deprecated name, please use entitlements.mac.plist");
    }

    if (resourceList.includes(`entitlements.osx.inherit.plist`)) {
      throw new (_builderUtil().InvalidConfigurationError)("entitlements.osx.inherit.plist is deprecated name, please use entitlements.mac.inherit.plist");
    }

    const customSignOptions = masOptions || this.platformSpecificBuildOptions;
    const entitlementsSuffix = masOptions == null ? "mac" : "mas";

    if (customSignOptions.entitlements == null) {
      const p = `entitlements.${entitlementsSuffix}.plist`;

      if (resourceList.includes(p)) {
        signOptions.entitlements = path.join(this.info.buildResourcesDir, p);
      }
    } else {
      signOptions.entitlements = customSignOptions.entitlements;
    }

    if (customSignOptions.entitlementsInherit == null) {
      const p = `entitlements.${entitlementsSuffix}.inherit.plist`;

      if (resourceList.includes(p)) {
        signOptions["entitlements-inherit"] = path.join(this.info.buildResourcesDir, p);
      }
    } else {
      signOptions["entitlements-inherit"] = customSignOptions.entitlementsInherit;
    }

    if (customSignOptions.provisioningProfile != null) {
      signOptions["provisioning-profile"] = customSignOptions.provisioningProfile;
    }
  } //noinspection JSMethodCanBeStatic


  async doSign(opts) {
    return (0, _electronOsxSign().signAsync)(opts);
  } //noinspection JSMethodCanBeStatic


  async doFlat(appPath, outFile, identity, keychain) {
    // productbuild doesn't created directory for out file
    await (0, _fsExtraP().ensureDir)(path.dirname(outFile));
    const args = (0, _pkg().prepareProductBuildArgs)(identity, keychain);
    args.push("--component", appPath, "/Applications");
    args.push(outFile);
    return await (0, _builderUtil().exec)("productbuild", args);
  }

  getElectronSrcDir(dist) {
    return path.resolve(this.projectDir, dist, this.info.framework.distMacOsAppName);
  }

  getElectronDestinationDir(appOutDir) {
    return path.join(appOutDir, this.info.framework.distMacOsAppName);
  } // todo fileAssociations


  async applyCommonInfo(appPlist, contentsPath) {
    const appInfo = this.appInfo;
    const appFilename = appInfo.productFilename; // https://github.com/electron-userland/electron-builder/issues/1278

    appPlist.CFBundleExecutable = appFilename.endsWith(" Helper") ? appFilename.substring(0, appFilename.length - " Helper".length) : appFilename;
    const icon = await this.getIconPath();

    if (icon != null) {
      const oldIcon = appPlist.CFBundleIconFile;
      const resourcesPath = path.join(contentsPath, "Resources");

      if (oldIcon != null) {
        await (0, _fs().unlinkIfExists)(path.join(resourcesPath, oldIcon));
      }

      const iconFileName = `${appFilename}.icns`;
      appPlist.CFBundleIconFile = iconFileName;
      await (0, _fs().copyFile)(icon, path.join(resourcesPath, iconFileName));
    }

    appPlist.CFBundleName = appInfo.productName;
    appPlist.CFBundleDisplayName = appInfo.productName;
    const minimumSystemVersion = this.platformSpecificBuildOptions.minimumSystemVersion;

    if (minimumSystemVersion != null) {
      appPlist.LSMinimumSystemVersion = minimumSystemVersion;
    }

    appPlist.CFBundleIdentifier = appInfo.macBundleIdentifier;
    appPlist.CFBundleShortVersionString = this.platformSpecificBuildOptions.bundleShortVersion || appInfo.version;
    appPlist.CFBundleVersion = appInfo.buildVersion;
    (0, _builderUtil().use)(this.platformSpecificBuildOptions.category || this.config.category, it => appPlist.LSApplicationCategoryType = it);
    appPlist.NSHumanReadableCopyright = appInfo.copyright;

    if (this.platformSpecificBuildOptions.darkModeSupport) {
      appPlist.NSRequiresAquaSystemAppearance = false;
    }

    const extendInfo = this.platformSpecificBuildOptions.extendInfo;

    if (extendInfo != null) {
      Object.assign(appPlist, extendInfo);
    }
  }

}

exports.default = MacPackager;

function getCertificateType(isMas, isDevelopment) {
  if (isDevelopment) {
    return "Mac Developer";
  }

  return isMas ? "3rd Party Mac Developer Application" : "Developer ID Application";
} 
// __ts-babel@6.0.4
//# sourceMappingURL=macPackager.js.map