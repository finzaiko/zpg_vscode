// Database Connection Management UI Component
class DBConnectionManager {
  constructor() {
    console.log("Ini constructor");

    this.window = null;
  }

  show() {
    if (this.window) {
      this.window.show();
      return;
    }

    this.window = webix.ui({
      view: "window",
      id: "dbConnectionWindow",
      head: "Database Connections",
      width: 600,
      height: 500,
      position: "center",
      modal: true,
      close: true,
      body: {
        rows: [
          {
            padding: 10,
            view: "form",
            id: "dbconn_form",
            // width: 500,
            type: "clean",
            // hidden: true,
            elements: [
              {
                cols: [
                  {
                    cols: [
                      {
                        view: "text",
                        label: "Name",
                        css: "white-labels",
                        name: "conn_name",
                        id: "dbconn_conn_name",
                        labelWidth: 70,
                      },
                      {
                        view: "colorpicker",
                        css: "short-picker",
                        name: "content",
                        css: "transparent-value-picker",
                        tooltip: "Color",
                        value: "#FFF",
                        width: 30,
                      },
                    ],
                  },
                  { width: 8 },
                  {
                    view: "text",
                    label: "Database",
                    name: "database",
                    css: "white-labels",
                    id: "dbconn_database",
                    labelWidth: 70,
                  },
                ],
              },
              {
                cols: [
                  {
                    view: "text",
                    label: "Host",
                    css: "white-labels",
                    name: "host",
                    id: "dbconn_host",
                    labelWidth: 70,
                  },
                  { width: 8 },
                  {
                    cols: [
                      {
                        view: "text",
                        label: "Port",
                        name: "port",
                        id: "dbconn_port",
                        css: "white-labels",
                        value: "5432",
                        type: "number",
                        labelWidth: 70,
                      },
                      { width: 8 },
                      {
                        view: "switch",
                        name: "ssl",
                        css: "white-labels white-background-switch",
                        value: 0,
                        label: "SSL",
                        labelWidth: 35,
                        width: 80,
                      },
                    ],
                  },
                ],
              },
              {
                cols: [
                  {
                    view: "text",
                    label: "Username",
                    css: "white-labels",
                    name: "user",
                    id: "dbconn_user",
                    labelWidth: 70,
                  },
                  { width: 8 },
                  {
                    view: "text",
                    label: "Password",
                    name: "password",
                    id: "dbconn_password",
                    type: "password",
                    css: "white-labels",
                    labelWidth: 70,
                    attributes: { autocomplete: "off" },
                    autocomplete: "new-password",
                  },
                ],
              },
            ],
          },
          {
            view: "toolbar",
            cols: [
              {
                view: "button",
                value: "Add New",
                width: 100,
                click: () => this.showConnectionForm(),
              },
              {
                view: "button",
                value: "Delete",
                width: 100,
                click: () => this.deleteConnection(),
              },
            ],
          },
          {
            view: "datatable",
            id: "connectionsList",
            columns: [
              { id: "name", header: "Name", fillspace: 1 },
              { id: "host", header: "Host", fillspace: 1 },
              { id: "database", header: "Database", fillspace: 1 },
              {
                id: "test",
                header: "Test",
                width: 70,
                template: "<span class='webix_icon mdi mdi-connection'></span>",
              },
            ],
            select: true,
            onClick: {
              "mdi-connection": (e, id) => this.testConnection(id),
            },
          },
        ],
      },
    });
  }

  showConnectionForm(data = {}) {
    webix
      .ui({
        view: "window",
        id: "connectionForm",
        move: true,
        head: data.id ? "Edit Connection" : "New Connection",
        width: 400,
        position: "center",
        modal: true,
        close: true,
        body: {
          view: "form",
          id: "connForm",
          elements: [
            { view: "text", label: "Name", name: "name", required: true },
            { view: "text", label: "Host", name: "host", required: true },
            { view: "text", label: "Port", name: "port", required: true },
            {
              view: "text",
              label: "Database",
              name: "database",
              required: true,
            },
            {
              view: "text",
              label: "Username",
              name: "username",
              required: true,
            },
            {
              view: "text",
              type: "password",
              label: "Password",
              name: "password",
              required: true,
            },
            {
              cols: [
                {
                  view: "button",
                  value: "Save",
                  css: "webix_primary",
                  click: () => this.saveConnection(),
                },
                {
                  view: "button",
                  value: "Cancel",
                  click: () => $$("connectionForm").close(),
                },
              ],
            },
          ],
        },
      })
      .show();

    if (data.id) {
      $$("connForm").setValues(data);
    }
  }

  saveConnection() {
    const form = $$("connForm");
    if (!form.validate()) return;

    const values = form.getValues();
    // Send connection data to VS Code extension
    vscode.postMessage({
      command: "saveConnection",
      connection: values,
    });

    $$("connectionForm").close();
    this.refreshConnectionsList();
  }

  deleteConnection() {
    const selected = $$("connectionsList").getSelectedId();
    if (!selected) {
      webix.message("Please select a connection to delete");
      return;
    }

    webix.confirm({
      title: "Delete Connection",
      text: "Are you sure you want to delete this connection?",
      callback: (result) => {
        if (result) {
          vscode.postMessage({
            command: "deleteConnection",
            connectionId: selected.id,
          });
          this.refreshConnectionsList();
        }
      },
    });
  }

  testConnection(id) {
    const row = $$("connectionsList").getItem(id);
    vscode.postMessage({
      command: "testConnection",
      connection: row,
    });
  }

  refreshConnectionsList() {
    vscode.postMessage({
      command: "getConnections",
    });
  }

  // Method to handle incoming messages from VS Code
  handleMessage(message) {
    switch (message.command) {
      case "connectionList":
        $$("connectionsList").clearAll();
        $$("connectionsList").parse(message.connections);
        break;
      case "testResult":
        webix.message({
          text: message.success
            ? "Connection successful!"
            : "Connection failed: " + message.error,
          type: message.success ? "success" : "error",
        });
        break;
    }
  }
}

// Export the class
window.DBConnectionManager = DBConnectionManager;
