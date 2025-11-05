// Handle messages from the extension
window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "saveSuccess":
      webix.message({ type: "success", text: "Connection saved successfully" });
      refreshConnectionsList();
      break;
    case "deleteSuccess":
      webix.message({
        type: "success",
        text: "Connection deleted successfully",
      });
      refreshConnectionsList();
      break;
    case "connectionList":
      if ($$("connectionsList")) {
        $$("connectionsList").clearAll();
        $$("connectionsList").parse(message.connections);
      }
      break;
    case "error":
      webix.message({ type: "error", text: message.error });
      break;
  }
});

function openDBManager() {
  const prefix = "dbconn_mgr";
  const winId = prefix + "_win",
    labelW = 70,
    labelWCol2 = 70,
    pageSize = 100;

  const close = () => {
    $$(prefix + "_form").clear();
    $$(prefix + "_win").destructor();
  };

  function save(isDuplicate = false) {
    const form = $$(prefix + "_form");
    if (!form.validate()) {
      webix.message({
        type: "error",
        text: "Please fill in all required fields",
      });
      //   return;
    } else {
      const values = form.getValues();
      console.log("values", values);

      // Prepare data for saving
      const connectionData = {
        name: values.conn_name,
        host: values.host,
        port: values.port,
        database: values.database,
        user: values.user,
        password: values.password,
        color: values.conn_color || "#D1D1D1",
        is_active: values.is_active || true,
        created_at: new Date().toISOString(),
      };

      // If in edit mode and not duplicating, include the id
      if (isEdit && !isDuplicate) {
        connectionData.id = values.id;
      }

      // Send to VS Code extension for SQLite storage
      vscode.postMessage({
        command: "saveConnection",
        connection: connectionData,
        isEdit: isEdit && !isDuplicate,
      });

      // Clear form and update UI
      form.clear();
      form.hide();
      $$(prefix + "_add_btn").show();
      $$(prefix + "_form_cancel_btn").hide();
      $$(prefix + "_save_btn").hide();
      $$(prefix + "_delete_btn").hide();
      $$(prefix + "_duplicate_btn").hide();
      $$(prefix + "_test_btn").hide();

      // Reset state
      isEdit = false;
      oldConnName = "";

      // Request refresh of connections list
      vscode.postMessage({
        command: "getConnections",
      });
      // if ($$(prefix + "_form").validate()) {
      //   const data = $$(prefix + "_form").getValues();
      //   console.log("data", data);
      // }
    }
  }

  const form = {
    padding: 10,
    view: "form",
    id: prefix + "_form",

    type: "clean",
    hidden: true,
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
                id: prefix + "_conn_name",
              },
              {
                view: "colorpicker",
                css: "transparent-value-picker short-picker white-labels",
                name: "content",
                tooltip: "Color",
                value: "#FFF",
                id: prefix + "_conn_color",
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
            id: prefix + "_database",
          },
        ],
      },
      {
        cols: [
          {
            view: "text",
            label: "Host",
            name: "host",
            css: "white-labels",
            id: prefix + "_host",
          },
          { width: 8 },
          {
            cols: [
              {
                view: "text",
                label: "Port",
                name: "port",
                id: prefix + "_port",
                value: "5432",
                type: "number",
                css: "white-labels",
                labelWidth: labelWCol2,
              },
              {
                view: "switch",
                css: "white-labels white-background-switch",
                name: "ssl",
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
            id: prefix + "_user",
          },
          { width: 8 },
          {
            view: "text",
            label: "Password",
            name: "password",
            css: "white-labels",
            id: prefix + "_password",
            type: "password",
            labelWidth: labelWCol2,
            attributes: { autocomplete: "off" },
            autocomplete: "new-password",
          },
        ],
      },
    ],
    rules: {
      conn_name: webix.rules.isNotEmpty,
      database: webix.rules.isNotEmpty,
      host: webix.rules.isNotEmpty,
      port: webix.rules.isNotEmpty,
    },
    on: {
      onAfterValidation: function (result, value) {
        if (!result) {
          let text = [];
          for (var key in value) {
            if (key === "conn_name") {
              text.push("Name can't be empty");
            }
            if (key === "database") {
              text.push("Database can't be empty");
            }
            if (key === "host") {
              text.push("Host can't be empty");
            }
            if (key === "port") {
              text.push("Port can't be empty");
            }
          }
          webix.message({ type: "error", text: text.join("<br>") });
        }
      },
    },
    elementsConfig: {
      labelPosition: "left",
      labelWidth: labelW,
      bottomPadding: 1,
    },
  };

  const formToolbar = {
    view: "toolbar",
    id: prefix + "_form_tb",
    css: "z-tb",
    width: 500,
    elements: [
      {
        cols: [
          {
            view: "button",
            label: "Add",
            autowidth: true,
            id: prefix + "_add_btn",
            click: function () {
              $$(prefix + "_form").show();
              $$(prefix + "_form").clear();
              $$(prefix + "_save_btn").show();
              $$(prefix + "_form_cancel_btn").show();
              $$(prefix + "_add_btn").hide();
              $$(prefix + "_test_btn").show();
              $$(prefix + "_port").setValue("5432");
              $$(prefix + "_conn_color").setValue("#D1D1D1");
              isEdit = false;
              oldConnName = "";
            },
          },
          //   { width: labelW + 10 },
          {
            view: "button",
            value: "Save",
            autowidth: true,
            hidden: true,
            id: prefix + "_save_btn",
            click: function () {
              save();
            },
          },
          {
            view: "button",
            value: "Delete",
            id: prefix + "_delete_btn",
            autowidth: true,
            hidden: true,
            click: function () {
              remove();
            },
          },
          {
            view: "button",
            value: "Duplicate",
            tooltip: "Duplicate selected",
            autowidth: true,
            hidden: true,
            id: prefix + "_duplicate_btn",
            click: function () {
              save(true);
            },
          },
          {
            view: "button",
            value: "Cancel",
            id: prefix + "_form_cancel_btn",
            autowidth: true,
            hidden: true,
            click: function () {
              $$(prefix + "_form").hide();
              $$(prefix + "_add_btn").show();
              $$(prefix + "_form_cancel_btn").hide();
              $$(prefix + "_save_btn").hide();
              $$(prefix + "_save_btn").setValue("Save");
              $$(prefix + "_delete_btn").hide();
              $$(prefix + "_dupicate_btn").hide();
              $$(prefix + "_table").clearSelection();
              isEdit = false;
              oldConnName = "";
            },
          },
          {},
          {
            view: "button",
            label: "Test",
            autowidth: true,
            hidden: true,
            id: prefix + "_test_btn",
            click: function () {
              let data = $$(prefix + "_form").getValues();
              data.type = 2;
              testConnection(false, data);
            },
          },
        ],
      },
    ],
  };

  const url = "http://localhost:3000";

  const grid = {
    view: "datatable",
    css: "db-connection-datatable",
    id: prefix + "_table",
    resizeColumn: true,
    scrollX: true,
    datafetch: pageSize,
    select: "row",
    height: 300,
    pager: "pagerA",
    editable: true,
    drag: "order",
    columns: [
      {
        id: "content",
        header: "",
        width: 6,
        // template: function (obj) {
        //   return obj.content !== null
        //     ? `<span style='border-radius: 2px;display: inline-block;width:4px;height:20px;background:${obj.content};margin-top:4px;'></span>`
        //     : "";
        // },
        template: function (obj) {
          return obj.content !== null
            ? `
            <span style='border-radius: 2px;display: inline-block;width:4px;height:20px;background:${obj.content};margin-top:4px;'></span>
            `
            : "";
        },
      },
      {
        id: "conn_name",
        header: ["Name", { content: "textFilter" }],
        width: 150,
      },
      {
        id: "database",
        header: ["Database", { content: "textFilter" }],
        width: 150,
      },
      {
        id: "host",
        header: ["Host", { content: "textFilter" }],
        width: 150,
      },
      {
        id: "port",
        header: ["Port", { content: "numberFilter" }],
        width: 100,
      },
      {
        id: "user",
        header: ["Username", { content: "textFilter" }],
        width: 150,
      },
      {
        id: "ssl",
        header: ["SSL", { content: "textFilter" }],
        width: 50,
      },
    ],
    on: {
      onLoadError: function (text, xml, xhr) {
        showError(xhr);
      },
      onBeforeLoad: function () {
        this.showOverlay("Loading...");
      },
      onAfterLoad: function () {
        this.hideOverlay();
      },
      onItemClick: function (sel) {
        $$(prefix + "_form").show();
        $$(prefix + "_form_cancel_btn").show();
        $$(prefix + "_save_btn").show();
        $$(prefix + "_save_btn").setValue("Update");
        $$(prefix + "_test_btn").show();
        $$(prefix + "_delete_btn").show();
        $$(prefix + "_duplicate_btn").show();
        $$(prefix + "_add_btn").hide();
        $$(prefix + "_password").setValue();
        isEdit = true;
        const item = this.getItem(sel);
        oldConnName = item.conn_name;
      },
      onItemDblClick: function () {},
      onAfterDrop: function (ctx, e) {
        updateQue(this);
      },
    },
    url: `${url}/conn?type=2`,
  };

  const winBody = {
    rows: [
      {
        rows: [
          form,
          formToolbar,
          grid,
          {
            view: "toolbar",
            elements: [
              {
                view: "pager",
                id: "pagerA",
                css: "z-pager-aligned-left",
                size: pageSize,
                template: function (data, common) {
                  return data.count > 0
                    ? `<span class='z-pager-no'>${data.count}</span>`
                    : "";
                },
              },
              {},
              {
                view: "button",
                value: "Close",
                autowidth: true,
                click: function () {
                  close();
                },
              },
            ],
          },
        ],
      },
    ],
  };

  webix
    .ui({
      view: "window",
      modal: true,
      id: winId,
      position: "center",
      move: true,
      width: 600,
      head: {
        height: 38,
        template: "DB Connection",
      },
      body: winBody,
    })
    .show();
}
