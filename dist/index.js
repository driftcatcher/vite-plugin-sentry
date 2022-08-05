'use strict';

var SentryCli = require('@sentry/cli');
var util = require('util');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var SentryCli__default = /*#__PURE__*/_interopDefaultLegacy(SentryCli);

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

/*
  Simple debug logger
*/
const debugLogger = (label, data) => {
    if (data) {
        console.log(`[Sentry Vite Plugin] ${label} ${util.inspect(data, false, null, true)}`);
    }
    else {
        console.log(`[Sentry Vite Plugin] ${label}`);
    }
};

/*
  Fake sentry cli - it just prints info on actions
*/
const createFakeCli = (cli, debug = debugLogger) => {
    const releases = {
        proposeVersion: () => cli.releases.proposeVersion().then((version) => {
            debug('Proposed version:\n', version);
            return version;
        }),
        new: (release) => {
            debug('Creating new release:\n', release);
            return Promise.resolve(release);
        },
        uploadSourceMaps: (release, config) => {
            debug('Calling upload-sourcemaps with:\n', config);
            return Promise.resolve(release);
        },
        finalize: (release) => {
            debug('Finalizing release:\n', release);
            return Promise.resolve(release);
        },
        setCommits: (release, config) => {
            debug('Calling set-commits with:\n', config);
            return Promise.resolve(release);
        },
        newDeploy: (release, config) => {
            debug('Calling deploy with:\n', config);
            return Promise.resolve(release);
        },
        listDeploys: function (release) {
            throw new Error('Function not implemented.');
        },
        execute: function (args, live) {
            throw new Error('Function not implemented.');
        }
    };
    const DummySentryCli = {
        releases,
        execute: function (args, live) {
            throw new Error('Function not implemented.');
        }
    };
    return DummySentryCli;
};

/*
  Initialize and return SentryCli instance
  On dryRun enabled - returns fake sentryCli
*/
const createSentryCli = (options) => {
    const sentryOptions = Object.assign({
        silent: false
    }, options);
    /*
      Initialize sentry cli
    */
    const cli = new SentryCli__default["default"](options.configFile, {
        authToken: sentryOptions.authToken,
        org: sentryOptions.org,
        project: sentryOptions.project,
        silent: sentryOptions.silent,
        url: sentryOptions.url,
        vcsRemote: sentryOptions.vcsRemote
    });
    /*
      Return fake sentry cli to run in dry mode
    */
    if (options.dryRun) {
        return createFakeCli(cli);
    }
    return cli;
};

/*
  Prepare sentry release and returns promise
*/
const getReleasePromise = (cli, options = {}) => {
    return (options.release
        ? Promise.resolve(options.release)
        : cli.releases.proposeVersion())
        .then((version) => `${version}`.trim())
        .catch(() => undefined);
};

/**
 * @deprecated Will be removed in one of next versions
 */
const DEPRECATED_MODULE_ID = 'virtual:vite-plugin-sentry/sentry-release';
const DEPRECATED_RESOLVED_ID = '\0' + DEPRECATED_MODULE_ID;
const MODULE_ID = 'virtual:vite-plugin-sentry/sentry-config';
const RESOLVED_ID = '\0' + MODULE_ID;
function ViteSentry(options) {
    const { skipEnvironmentCheck = false } = options;
    const cli = createSentryCli(options);
    const currentReleasePromise = getReleasePromise(cli, options);
    // plugin state
    let pluginState = {
        enabled: false,
        sourcemapsCreated: false,
        isProduction: false
    };
    const viteSentryPlugin = {
        name: 'sentry',
        enforce: 'post',
        apply(config, { command }) {
            var _a;
            // disable plugin in SSR mode
            // TODO: maybe there is better solution to upload generated SSR artifacts too
            if ((_a = config.build) === null || _a === void 0 ? void 0 : _a.ssr) {
                return false;
            }
            return true;
        },
        /*
          define SENTRY_RELEASE to `import.meta.env.SENTRY_RELEASE`
        */
        config() {
            return __awaiter(this, void 0, void 0, function* () {
                const currentRelease = yield currentReleasePromise;
                return {
                    define: {
                        /**
                         * @deprecated use VITE_PLUGIN_SENTRY_CONFIG instead
                         */
                        'import.meta.env.SENTRY_RELEASE': JSON.stringify({
                            id: currentRelease
                        }),
                        'import.meta.env.VITE_PLUGIN_SENTRY_CONFIG': JSON.stringify({
                            dist: options.sourceMaps.dist,
                            release: currentRelease
                        })
                    }
                };
            });
        },
        /*
          Check incoming config and decise - enable plugin or not
          We don't want enable plugin for non-production environments
          also we dont't want to enable with disabled sourcemaps
        */
        configResolved(config) {
            pluginState.sourcemapsCreated = !!config.build.sourcemap;
            pluginState.isProduction = config.isProduction;
            pluginState.enabled =
                pluginState.sourcemapsCreated &&
                    (skipEnvironmentCheck || config.isProduction);
        },
        /*
          Resolve id for virtual module
        */
        resolveId(id) {
            if (id === DEPRECATED_MODULE_ID) {
                this.warn('\n\nDEPRECATION NOTICE:\n\nSeems that you are using sentry-release virtual module.\n' +
                    "It's deprecated now and will be removed in next versions, please use virtual:vite-plugin-sentry/sentry-config instead" +
                    'New virtual module provide { dist, release } instead of just release string\n' +
                    'So instead of import.meta.env.SENTRY_RELEASE.id, you can use import.meta.env.VITE_PLUGIN_SENTRY_CONFIG.release');
                return DEPRECATED_RESOLVED_ID;
            }
            if (id === MODULE_ID) {
                return RESOLVED_ID;
            }
        },
        /*
          Provide virtual module
        */
        load(id) {
            /**
             * @deprecated Will be removed on one of next releases
             */
            if (id === DEPRECATED_RESOLVED_ID) {
                return 'globalThis.SENTRY_RELEASE = import.meta.env.SENTRY_RELEASE\n';
            }
            if (id === RESOLVED_ID) {
                return 'globalThis.VITE_PLUGIN_SENTRY_CONFIG = import.meta.env.VITE_PLUGIN_SENTRY_CONFIG\n';
            }
        },
        /*
          We starting plugin here, because at the moment vite completed with building
          so sourcemaps must be ready
        */
        closeBundle() {
            return __awaiter(this, void 0, void 0, function* () {
                const { enabled, sourcemapsCreated, isProduction } = pluginState;
                if (!enabled) {
                    if (!isProduction) {
                        this.warn('Skipped because running non-production build. If you want to run it anyway set skipEnvironmentCheck option value to true');
                    }
                    else if (!sourcemapsCreated) {
                        this.warn('Skipped because vite is not configured to provide sourcemaps. Please check configuration setting [options.sourcemap]!');
                    }
                }
                else {
                    if (!isProduction && skipEnvironmentCheck) {
                        this.warn('Running in non-production mode!');
                    }
                    const currentRelease = yield currentReleasePromise;
                    if (!currentRelease) {
                        this.warn('Release returned from sentry is empty! Please check your config');
                    }
                    else {
                        try {
                            // create release
                            yield cli.releases.new(currentRelease);
                            if (options.cleanArtifacts) {
                                yield cli.releases.execute(['releases', 'files', currentRelease, 'delete', '--all'], true);
                            }
                            // upload source maps
                            yield cli.releases.uploadSourceMaps(currentRelease, options.sourceMaps);
                            // set commits
                            if (options.setCommits) {
                                const { commit, repo, auto } = options.setCommits;
                                if (auto || (repo && commit)) {
                                    yield cli.releases.setCommits(currentRelease, options.setCommits);
                                }
                            }
                            // finalize release
                            if (options.finalize) {
                                yield cli.releases.finalize(currentRelease);
                            }
                            // set deploy options
                            if (options.deploy && options.deploy.env) {
                                yield cli.releases.newDeploy(currentRelease, options.deploy);
                            }
                        }
                        catch (error) {
                            this.warn(`Error while uploading sourcemaps to Sentry: ${error.message}`);
                        }
                    }
                }
            });
        }
    };
    return viteSentryPlugin;
}

module.exports = ViteSentry;
//# sourceMappingURL=index.js.map
