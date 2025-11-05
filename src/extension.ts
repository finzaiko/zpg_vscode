import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

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
                    switch (message.command) {
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
