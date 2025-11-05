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
                options: [
                  { id: "conn1", value: "Connection 1" },
                  { id: "conn2", value: "Connection 2" },
                  { id: "conn3", value: "Connection 3" },
                ],
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
                  // console.log("Manage DB Connection clicked");
                  // if (!window.dbManager) {
                  //   window.dbManager = new DBConnectionManager();
                  // }
                  // window.dbManager.show();
                  openDBManager();
                },
              },
              {
                view: "button",
                id: "executeBtn",
                value: "Execute",
                width: 100,
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
            columns: [
              { id: "rank", header: "", width: 50 },
              { id: "title", header: "Film title", width: 200 },
              { id: "year", header: "Released", width: 80 },
              { id: "votes", header: "Votes", width: 100 },
            ],
            data: [
              {
                id: 1,
                title: "The Shawshank Redemption",
                year: 1994,
                votes: 678790,
                rank: 1,
              },
              {
                id: 2,
                title: "The Godfather",
                year: 1972,
                votes: 511495,
                rank: 2,
              },
            ],
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

          // Setup event handlers
          $$("executeBtn").attachEvent("onItemClick", function () {
            const query = editor.getValue();
            const connection = $$("connectionCombo").getValue();
            vscode.postMessage({
              command: "execute",
              query: query,
              connection: connection,
            });
          });

          // Set up message listener
          window.addEventListener("message", (event) => {
            const message = event.data;
            switch (message.command) {
              case "connections":
                $$("connectionCombo").define("options", message.connections);
                $$("connectionCombo").refresh();
                break;
              case "results":
                const columns = message.columns.map((col) => ({
                  id: col,
                  header: col,
                  adjust: true,
                }));
                $$("resultGrid").config.columns = columns;
                $$("resultGrid").refreshColumns();
                $$("resultGrid").clearAll();
                $$("resultGrid").parse(message.data);
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
