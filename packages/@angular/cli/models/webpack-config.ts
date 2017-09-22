const webpackMerge = require('webpack-merge');
import { CliConfig } from './config';
import { BuildOptions } from './build-options';
import {
  getBrowserConfig,
  getCommonConfig,
  getDevConfig,
  getProdConfig,
  getStylesConfig,
  getServerConfig,
  getNonAotConfig,
  getAotConfig
} from './webpack-configs';
import * as path from 'path';
import { AngularCompilerPlugin } from '@ngtools/webpack';

export interface WebpackConfigOptions<T extends BuildOptions = BuildOptions> {
  projectRoot: string;
  buildOptions: T;
  appConfig: any;
}

export class NgCliWebpackConfig<T extends BuildOptions = BuildOptions> {
  public config: any;
  public wco: WebpackConfigOptions<T>;
  constructor(buildOptions: T, appConfig: any) {

    this.validateBuildOptions(buildOptions);

    const configPath = CliConfig.configFilePath();
    const projectRoot = path.dirname(configPath);

    appConfig = this.addAppConfigDefaults(appConfig);
    buildOptions = this.addTargetDefaults(buildOptions);
    buildOptions = this.mergeConfigs(buildOptions, appConfig, projectRoot);

    this.wco = { projectRoot, buildOptions, appConfig };
  }

  public buildConfig() {
    const platformConfig = this.wco.appConfig.platform === 'server' ?
      getServerConfig(this.wco) : getBrowserConfig(this.wco);

    let webpackConfigs = [
      getCommonConfig(this.wco),
      platformConfig,
      getStylesConfig(this.wco),
      this.getTargetConfig(this.wco)
    ];

    if (this.wco.appConfig.main || this.wco.appConfig.polyfills) {
      const typescriptConfigPartial = this.wco.buildOptions.aot
        ? getAotConfig(this.wco)
        : getNonAotConfig(this.wco);
      webpackConfigs.push(typescriptConfigPartial);
    }

    this.config = webpackMerge(webpackConfigs);
    return this.config;
  }

  public getTargetConfig(webpackConfigOptions: WebpackConfigOptions<T>): any {
    switch (webpackConfigOptions.buildOptions.target) {
      case 'development':
        return getDevConfig(webpackConfigOptions);
      case 'production':
        return getProdConfig(webpackConfigOptions);
    }
  }

  // Validate build options
  public validateBuildOptions(buildOptions: BuildOptions) {
    buildOptions.target = buildOptions.target || 'development';
    if (buildOptions.target !== 'development' && buildOptions.target !== 'production') {
      throw new Error("Invalid build target. Only 'development' and 'production' are available.");
    }

    if (buildOptions.buildOptimizer
      && !(buildOptions.aot || buildOptions.target === 'production')) {
      throw new Error('The `--build-optimizer` option cannot be used without `--aot`.');
    }

    if (buildOptions.experimentalAngularCompiler && !AngularCompilerPlugin.isSupported()) {
      throw new Error('You need Angular 5 and up to use --experimental-angular-compiler.');
    }
  }

  // Fill in defaults for build targets
  public addTargetDefaults(buildOptions: T): T {
    const targetDefaults: { [target: string]: Partial<BuildOptions> } = {
      development: {
        environment: 'dev',
        outputHashing: 'media',
        sourcemaps: true,
        extractCss: false,
        namedChunks: true,
        aot: false
      },
      production: {
        environment: 'prod',
        outputHashing: 'all',
        sourcemaps: false,
        extractCss: true,
        namedChunks: false,
        aot: true
      }
    };

    return Object.assign({}, targetDefaults[buildOptions.target], buildOptions);
  }

  // Fill in defaults from .angular-cli.json
  public mergeConfigs(buildOptions: T, appConfig: any, projectRoot: string): T {
    const mergeableOptions: Partial<BuildOptions> = {
      outputPath: path.resolve(projectRoot, appConfig.outDir),
      deployUrl: appConfig.deployUrl,
      baseHref: appConfig.baseHref
    };

    return Object.assign({}, mergeableOptions, buildOptions);
  }

  public addAppConfigDefaults(appConfig: any) {
    const appConfigDefaults: any = {
      testTsconfig: appConfig.tsconfig,
      scripts: [],
      styles: []
    };

    // can't use Object.assign here because appConfig has a lot of getters/setters
    for (let key of Object.keys(appConfigDefaults)) {
      appConfig[key] = appConfig[key] || appConfigDefaults[key];
    }

    return appConfig;
  }
}
