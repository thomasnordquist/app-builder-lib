import { WinPackager } from "../../winPackager";
import { NsisTarget } from "./NsisTarget";
import { AppPackageHelper } from "./nsisUtil";
/** @private */
export declare class WebInstallerTarget extends NsisTarget {
    constructor(packager: WinPackager, outDir: string, targetName: string, packageHelper: AppPackageHelper);
    readonly isWebInstaller: boolean;
    protected configureDefines(oneClick: boolean, defines: any): Promise<any>;
    protected readonly installerFilenamePattern: string;
    protected generateGitHubInstallerName(): string;
}
