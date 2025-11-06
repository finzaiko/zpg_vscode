import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';
import { DatabaseManager } from './database';

export async function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    // Initialize database
    const dbManager = DatabaseManager.getInstance();
    await dbManager.initialize(context);

    let disposable = vscode.commands.registerCommand('zpg-editor.openEditor', () => {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (currentPanel) {
            currentPanel.reveal(columnToShowIn);
        } else {
            currentPanel = vscode.window.createWebviewPanel(
                'zpgEditor',
                'ZPG Editor',
                columnToShowIn || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    enableCommandUris: true,
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'node_modules')),
                        vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
                    ]
                }
            );

            // Get paths to required resources
            const webixJsPath = vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'webix', 'webix.min.js'));
            const webixCssPath = vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'webix', 'skins', 'mini.min.css'));
            const mdiCssPath = vscode.Uri.file(path.join(context.extensionPath, 'node_modules', '@mdi', 'font', 'css', 'materialdesignicons.min.css'));
            const monacoBasePath = vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'monaco-editor', 'min', 'vs'));
            const monacoLoaderPath = vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'monaco-editor', 'min', 'vs', 'loader.js'));
            const monacoCssPath = vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'monaco-editor', 'min', 'vs', 'editor', 'editor.main.css'));
            const editorJsPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview', 'editor.js'));
            const dbconnectionJsPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview', 'dbconnection.js'));
            const stylesCssPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview', 'styles.css'));

            // Get the HTML content
            const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'editor.html');
            let html = fs.readFileSync(htmlPath, 'utf8');

            // Replace placeholders with actual URIs
            html = html.replace('#{webixJs}', currentPanel.webview.asWebviewUri(webixJsPath).toString());
            html = html.replace('#{webixCss}', currentPanel.webview.asWebviewUri(webixCssPath).toString());
            html = html.replace('#{mdiCss}', currentPanel.webview.asWebviewUri(mdiCssPath).toString());
            html = html.replace('#{monacoBase}', currentPanel.webview.asWebviewUri(monacoBasePath).toString());
            html = html.replace('#{monacoLoader}', currentPanel.webview.asWebviewUri(monacoLoaderPath).toString());
            html = html.replace('#{monacoCss}', currentPanel.webview.asWebviewUri(monacoCssPath).toString());
            html = html.replace('#{editorJs}', currentPanel.webview.asWebviewUri(editorJsPath).toString());
            html = html.replace('#{dbconnectionJs}', currentPanel.webview.asWebviewUri(dbconnectionJsPath).toString());
            html = html.replace('#{stylesCss}', currentPanel.webview.asWebviewUri(stylesCssPath).toString());

            currentPanel.webview.html = html;

            // Handle messages from the webview
            currentPanel.webview.onDidReceiveMessage(
                async message => {
                    try {
                        switch (message.command) {
                            case 'getClipboardText':
                                const clipboardText = await vscode.env.clipboard.readText();
                                currentPanel?.webview.postMessage({
                                    command: 'clipboardText',
                                    text: clipboardText
                                });
                                break;
                            case 'execute':
                                try {
                                    const client = new Client(message.connection);
                                    await client.connect();
                                    const result = await client.query(message.query);
                                    await client.end();

                                    // Send results back to webview
                                    currentPanel?.webview.postMessage({
                                        command: 'results',
                                        columns: result.fields.map((field: { name: string }) => field.name),
                                        data: result.rows
                                    });
                                } catch (err: any) {
                                    vscode.window.showErrorMessage(`Error executing query: ${err.message}`);
                                }
                                break;

                            case 'saveConnection':
                                try {
                                    await dbManager.saveConnection(message.connection, message.isEdit);
                                    currentPanel?.webview.postMessage({
                                        command: 'saveSuccess'
                                    });
                                    // Automatically refresh the connections list
                                    const connections = await dbManager.getConnections();
                                    currentPanel?.webview.postMessage({
                                        command: 'connectionList',
                                        connections
                                    });
                                } catch (err: any) {
                                    vscode.window.showErrorMessage(`Error saving connection: ${err.message}`);
                                }
                                break;

                            case 'getConnections':
                                try {
                                    const connections = await dbManager.getConnections();
                                    currentPanel?.webview.postMessage({
                                        command: 'connectionList',
                                        connections
                                    });
                                } catch (err: any) {
                                    vscode.window.showErrorMessage(`Error fetching connections: ${err.message}`);
                                }
                                break;

                            case 'deleteConnection':
                                try {
                                    await dbManager.deleteConnection(message.connectionId);
                                    currentPanel?.webview.postMessage({
                                        command: 'deleteSuccess'
                                    });
                                    // Refresh the connections list after deletion
                                    const connections = await dbManager.getConnections();
                                    currentPanel?.webview.postMessage({
                                        command: 'connectionList',
                                        connections
                                    });
                                } catch (err: any) {
                                    vscode.window.showErrorMessage(`Error deleting connection: ${err.message}`);
                                }
                                break;
                        }
                    } catch (err: any) {
                        vscode.window.showErrorMessage(`Operation failed: ${err.message}`);
                    }
                },
                undefined,
                context.subscriptions
            );

            // Reset when the panel is closed
            currentPanel.onDidDispose(
                () => {
                    currentPanel = undefined;
                },
                null,
                context.subscriptions
            );
        }
    });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
