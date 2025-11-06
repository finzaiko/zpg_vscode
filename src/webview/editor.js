// Initialize when everything is loaded
(function () {
  const debug = document.getElementById("debug");
  let editor;
  let showDebug = false; // Control debug visibility

  // Debug logging function
  function log(message) {
    if (!debug) {
      return;
    }
    debug.textContent += "\n" + message;
    if (!showDebug) {
      debug.style.display = "none";
    }
  }

  // Function to refresh connections list
  function refreshConnections() {
    vscode.postMessage({
      command: "getConnections"
    });
  }

  // Handle messages from the extension
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "connectionList":
        const combo = $$("connectionCombo");
        if (combo) {
          const options = message.connections.map(conn => ({
            id: conn.id,
            value: `${conn.name} (${conn.database}@${conn.host})`,
            connection: conn // Store full connection info
          }));
          combo.define("options", options);
          combo.refresh();
        }
        break;
    }
  });

  // Function to toggle debug visibility
  window.toggleDebug = function () {
    showDebug = !showDebug;
    if (debug) {
      debug.style.display = showDebug ? "block" : "none";
    }
  };

  // Create the UI with Webix
  function createUI() {
    try {
      log("Creating Webix UI");
      if (typeof webix === "undefined") {
        log("Webix not available");
        return false;
      }

      // Setup resize handler
      window.addEventListener("resize", function () {
        const monacoView = $$("monacoEditor");
        if (monacoView) {
          const appHeight = document.getElementById("app").offsetHeight;
          monacoView.define("height", Math.floor(appHeight * 0.6));
          monacoView.resize();
        }
      });

      // Function to calculate editor height
      function calculateEditorHeight() {
        const appHeight = document.getElementById("app").offsetHeight;
        return Math.max(300, Math.floor(appHeight * 0.6)); // minimum 300px or 60% of height
      }

      // Setup resize handler
      window.addEventListener("resize", function () {
        const monacoView = $$("monacoEditor");
        if (monacoView) {
          monacoView.define("height", calculateEditorHeight());
          monacoView.resize();
          if (editor) {
            editor.layout();
          }
        }
      });

      webix.ui({
        container: "app",
        width: "100%",
        height: "100%",
        rows: [
          {
            view: "toolbar",
            cols: [
              {
                view: "button",
                type: "icon",
                autowidth: true,
                css: "zmdi_padding zmdi_color_white",
                tooltip: "Open new Query",
                icon: "mdi mdi-play-box-multiple-outline",
              },
              {
                view: "combo",
                id: "connectionCombo",
                placeholder: "Select Connection",
                width: 300,
                options: [],
              },
              {
                view: "button",
                type: "icon",
                css: "zmdi_padding zmdi_color_white",
                id: "dbconn_manage",
                autowidth: true,
                tooltip: "Manage DB Connection",
                icon: "mdi mdi-connection",
                click: function () {
                  openDBManager();
                },
              },
              {
                view: "button",
                id: "executeBtn",
                value: "Execute",
                width: 100,
                click: function() {
                  const query = editor.getValue();
                  const combo = $$("connectionCombo");
                  const selectedItem = combo.getPopup().getList().getItem(combo.getValue());

                  if (!selectedItem) {
                    webix.message({ type: "error", text: "Please select a connection first" });
                    return;
                  }

                  if (!query.trim()) {
                    webix.message({ type: "error", text: "Please enter a SQL query" });
                    return;
                  }

                  // Show loading in result grid
                  $$("resultGrid").showOverlay("Executing query...");

                  vscode.postMessage({
                    command: "execute",
                    query: query,
                    connection: selectedItem.connection // Send the full connection info
                  });
                },
              },
            ],
          },
          {
            view: "template",
            id: "monacoEditor",
            css: "monaco-editor-container",
            height: calculateEditorHeight(),
            template:
              "<div id='editorContainer' style='width:100%;height:100%;'></div>",
            on: {
              onViewResize: function () {
                if (editor) {
                  editor.layout();
                }
              },
            },
          },
          { view: "resizer" },

          {
            view: "datatable",
            id: "resultGrid",
            css: "result-datatable",
            autoheight: false,
            select: "row",
            resizeColumn: true,
            fixedRowHeight: false,
            scrollX: true,
            scrollY: true,
            export: true,
            leftSplit: 0,
            rightSplit: 0,
            columnWidth: 100,
            columns: [],
            data: [],
            on: {
              onBeforeLoad: function() {
                this.showOverlay("Loading...");
              },
              onAfterLoad: function() {
                this.hideOverlay();
                if (!this.count()) {
                  this.showOverlay("No data to display");
                }
              }
            },
          },
        ],
      });
      log("Webix UI created");
      return true;
    } catch (e) {
      log("Error creating UI: " + e.message);
      console.error("UI error:", e);
      return false;
    }
  }

  // Initialize Monaco editor
  function initMonaco() {
    try {
      log("Initializing Monaco");
      if (typeof require === "undefined") {
        log("Monaco require not available");
        return false;
      }

      const monacoScript = document.querySelector(
        'script[src*="vs/loader.js"]'
      );
      if (!monacoScript) {
        log("Monaco script not found");
        return false;
      }

      const basePath = monacoScript.src.replace("/vs/loader.js", "");
      require.config({ paths: { vs: basePath + "/vs" } });

      require(["vs/editor/editor.main"], function () {
        try {
          log("Creating Monaco editor");
          const container = document.getElementById("editorContainer");
          editor = monaco.editor.create(container, {
            value: "",
            language: "sql",
            theme: "vs-dark",
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderWhitespace: "selection",
            renderLineHighlight: "all",
            rulers: [],
            overviewRulerBorder: false,
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          });

          // No need for setup here as the button click is handled in the UI definition

          // Set up message listener
          window.addEventListener("message", (event) => {
            const message = event.data;
            const grid = $$("resultGrid");

            switch (message.command) {
              case "results":
                // Hide loading overlay
                grid.hideOverlay();

                if (message.error) {
                  webix.message({ type: "error", text: message.error });
                  grid.clearAll();
                  grid.showOverlay("No data to display");
                  return;
                }

                // Check if we have data to display
                if (!message.data || message.data.length === 0) {
                  grid.clearAll();
                  grid.showOverlay("No data returned");
                  return;
                }

                // Configure columns based on the field names from PostgreSQL
                const columns = message.columns.map(colName => ({
                  id: colName,
                  header: [
                    { text: colName },
                    { content: "textFilter" }  // Add filter for each column
                  ],
                  adjust: "data",  // Auto-adjust width based on content
                  sort: "string"   // Enable sorting
                }));

                // Update grid configuration
                grid.config.columns = columns;
                grid.refreshColumns();
                grid.clearAll();

                // Load the data
                grid.parse(message.data);

                // Show record count
                webix.message({ type: "success", text: `Query returned ${message.data.length} records` });
                break;

              case "queryError":
                grid.hideOverlay();
                webix.message({ type: "error", text: message.error });
                grid.clearAll();
                grid.showOverlay("Error executing query");
                break;

              case "connectionList":
                const combo = $$("connectionCombo");
                if (combo) {
                  const options = message.connections.map(conn => ({
                    id: conn.id,
                    value: `${conn.name} (${conn.database}@${conn.host})`,
                    connection: conn
                  }));
                  combo.define("options", options);
                  combo.refresh();
                }
                break;
            }
          });

          log("Monaco setup complete");
        } catch (e) {
          log("Error in Monaco setup: " + e.message);
          console.error("Monaco setup error:", e);
        }
      });
      return true;
    } catch (e) {
      log("Error initializing Monaco: " + e.message);
      console.error("Monaco init error:", e);
      return false;
    }
  }

  // Main initialization function
  function init() {
    try {
      debug.textContent += "\nStarting full initialization";

      // Create UI first
      if (!createUI()) {
        debug.textContent += "\nUI creation failed, retrying...";
        setTimeout(window.init, 100);
        return;
      }

      // Load initial connections
      refreshConnections();

      // Then setup Monaco
      if (!initMonaco()) {
        debug.textContent += "\nMonaco setup failed, retrying...";
        setTimeout(window.init, 100);
        return;
      }

      debug.textContent += "\nInitialization complete";
    } catch (e) {
      debug.textContent += "\nGlobal initialization error: " + e.message;
      console.error("Global init error:", e);
      setTimeout(window.init, 100);
    }
  }

  // Expose initialization function globally
  window.init = init;
})();
