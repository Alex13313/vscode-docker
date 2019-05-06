/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

// See https://github.com/Microsoft/vscode-azuretools/wiki/webpack for guidance

'use strict';

const process = require('process');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const StringReplacePlugin = require("string-replace-webpack-plugin");
const dev = require("vscode-azureextensiondev");

let DEBUG_WEBPACK = !!process.env.DEBUG_WEBPACK;

let config = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',

    externalNodeModules: [
        // Modules that we can't easily webpack for some reason.
        // These and their dependencies will be copied into node_modules rather than placed in the bundle
        // Keep this list small, because all the subdependencies will also be excluded

        // has binary
        'win-ca'
    ],
    entries: {
        // Note: Each entry is a completely separate Node.js application that cannot interact with any
        // of the others, and that individually includes all dependencies necessary (i.e. common
        // dependencies will have a copy in each entry file, no sharing).

        // Separate module for the language server (doesn't share any code with extension.js)
        './dockerfile-language-server-nodejs/lib/server': './node_modules/dockerfile-language-server-nodejs/lib/server.js'
    },

    externals:
    {
        // ./getCoreNodeModule.js (path from keytar.ts) uses a dynamic require which can't be webpacked
        './getCoreNodeModule': 'commonjs getCoreNodeModule',

        'win-ca/fallback': 'commonjs win-ca/fallback',
    }, // end of externals

    loaderRules: [
        {
            // Fix error:
            //   > WARNING in ./node_modules/engine.io/lib/server.js 67:43-65
            //   > Critical dependency: the request of a dependency is an expression
            // in this code:
            //   var WebSocketServer = (this.wsEngine ? require(this.wsEngine) : require('ws')).Server;
            test: /engine\.io[/\\]lib[/\\]server.js$/,
            loader: StringReplacePlugin.replace({
                replacements: [
                    {
                        pattern: /var WebSocketServer = \(this.wsEngine \? require\(this\.wsEngine\) : require\('ws'\)\)\.Server;/ig,
                        replacement: function (match, offset, string) {
                            // Since we're not using the wsEngine option, we'll just require it to not be set and use only the `require('ws')` call.
                            return `if (!!this.wsEngine) {
                                            throw new Error('wsEngine option not supported with current webpack settings');
                                        }
                                        var WebSocketServer = require('ws').Server;`;
                        }
                    }
                ]
            })
        },

        {
            // Fix warning:
            //   > WARNING in ./node_modules/cross-spawn/index.js
            //   > Module not found: Error: Can't resolve 'spawn-sync' in 'C:\Users\<user>\Repos\vscode-cosmosdb\node_modules\cross-spawn'
            //   > @ ./node_modules/cross-spawn/index.js
            // in this code:
            //   cpSpawnSync = require('spawn-sync');  // eslint-disable-line global-require
            test: /cross-spawn[/\\]index\.js$/,
            loader: StringReplacePlugin.replace({
                replacements: [
                    {
                        pattern: /cpSpawnSync = require\('spawn-sync'\);/ig,
                        replacement: function (match, offset, string) {
                            // The code in question only applies to Node 0.10 or less (see comments in code), so just throw an error
                            return `throw new Error("This shouldn't happen"); // MODIFIED`;
                        }
                    }
                ]
            })
        },

        {
            // Unpack UMD module headers used in some modules since webpack doesn't
            // handle them.
            test: /dockerfile-language-service|vscode-languageserver-types/,
            use: { loader: 'umd-compat-loader' }
        },

        {
            // Fix error in win-ca: Module parse failed: 'return' outside of function (5:2)
            //
            // if (process.platform !== 'win32') {
            //    return;  <<<<<<<<<<
            // }
            test: /win-ca[/\\]lib[/\\]index.js$/,
            loader: StringReplacePlugin.replace({
                replacements: [
                    {
                        pattern: /return;/ig,
                        replacement: function (match, offset, string) {
                            return `// Don't need platform check - we do that before calling the module`;
                        }
                    }
                ]
            })
        },
        {
            // Fix error in mac-ca: Module parse failed: 'return' outside of function (7:2)
            //
            // if (process.platform !== 'darwin') {
            //     module.exports.all = () => [];
            //     module.exports.each = () => {};
            //     return;  <<<<<<<<<
            //   }
            test: /mac-ca[/\\]index.js$/,
            loader: StringReplacePlugin.replace({
                replacements: [
                    {
                        pattern: /return;/ig,
                        replacement: function (match, offset, string) {
                            return `// Don't need platform check - we do that before calling the module`;
                        }
                    }
                ]
            })
        }
    ], // end of loaderRules

    plugins: [
        // Replace vscode-languageserver/lib/files.js with a modified version that doesn't have webpack issues
        new webpack.NormalModuleReplacementPlugin(
            /[/\\]vscode-languageserver[/\\]lib[/\\]files\.js/,
            require.resolve('./build/vscode-languageserver-files-stub.js')
        ),

        // Copy files to dist folder where the runtime can find them
        new CopyWebpackPlugin([
            // getCoreNodeModule.js -> dist/node_modules/getCoreNodeModule.js
            { from: './out/utils/getCoreNodeModule.js', to: 'node_modules' }
        ])
    ]
});

if (DEBUG_WEBPACK) {
    console.log('Config:', config);
}

module.exports = config;
