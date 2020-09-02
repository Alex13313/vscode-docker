/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { copyWizardContext } from './copyWizardContext';
import { ChooseComposeStep } from './wizard/ChooseComposeStep';
import { ChoosePlatformStep } from './wizard/ChoosePlatformStep';
import { ChooseWorkspaceFolderStep } from './wizard/ChooseWorkspaceFolderStep';
import { ScaffoldFileStep } from './wizard/ScaffoldFileStep';
import { ScaffoldingWizardContext } from './wizard/ScaffoldingWizardContext';

export async function scaffold(wizardContext: Partial<ScaffoldingWizardContext>, priorWizardContext?: ScaffoldingWizardContext): Promise<void> {
    copyWizardContext(wizardContext, priorWizardContext);
    wizardContext.scaffoldType = 'all';

    const promptSteps: AzureWizardPromptStep<ScaffoldingWizardContext>[] = [
        new ChooseWorkspaceFolderStep(),
        new ChooseComposeStep(),
        new ChoosePlatformStep(),
    ];

    const executeSteps: AzureWizardExecuteStep<ScaffoldingWizardContext>[] = [
        new ScaffoldFileStep('.dockerignore', 100),
        new ScaffoldFileStep('Dockerfile', 200),
    ];

    const wizard = new AzureWizard<ScaffoldingWizardContext>(wizardContext as ScaffoldingWizardContext, {
        promptSteps: promptSteps,
        executeSteps: executeSteps,
        title: localize('vscode-docker.scaffold.addDockerFiles', 'Add Docker Files'),
    });

    await wizard.prompt();
    await wizard.execute();

    if (wizardContext.scaffoldCompose) {
        await vscode.commands.executeCommand('vscode-docker.configureCompose', wizardContext);
    }

    // TODO: telem
}