import * as vscode from "vscode";
import * as path from "path";
import sqlite3 = require("sqlite3");
import { Database, open } from "sqlite";

export class DatabaseManager {
    private db: Database | null = null;
    private static instance: DatabaseManager;

    private constructor() {}

    static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    async initialize(context: vscode.ExtensionContext) {
        if (this.db) {
            return;
        }

        const dbPath = path.join(context.globalStoragePath, "connections.db");

        // Log the database path
        console.log('SQLite database path:', dbPath);

        // Ensure the directory exists
        const dbDir = path.dirname(dbPath);
        if (!require("fs").existsSync(dbDir)) {
            require("fs").mkdirSync(dbDir, { recursive: true });
            console.log('Created database directory:', dbDir);
        }

        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        // Create connections table if it doesn't exist
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                database TEXT NOT NULL,
                user TEXT NOT NULL,
                password TEXT NOT NULL,
                color TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )
        `);
    }

    async saveConnection(connection: any, isEdit: boolean = false) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        console.log("connection", connection);

        try {
            if (isEdit && connection.id) {
                console.log("UPDATE /////", connection.id);
                // Update existing connection
                await this.db.run(
                    `
                    UPDATE connections
                    SET name = ?, host = ?, port = ?, database = ?,
                        user = ?, password = ?, color = ?, is_active = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `,
                    [
                        connection.name,
                        connection.host,
                        connection.port,
                        connection.database,
                        connection.user,
                        connection.password,
                        connection.color,
                        connection.is_active ? 1 : 0,
                        connection.id,
                    ],
                );
            } else {
                console.log("INSERT /////");

                // Insert new connection
                await this.db.run(
                    `
                    INSERT INTO connections (
                        name, host, port, database, user, password,
                        color, is_active, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `,
                    [
                        connection.name,
                        connection.host,
                        connection.port,
                        connection.database,
                        connection.user,
                        connection.password,
                        connection.color,
                        connection.is_active ? 1 : 0,
                    ],
                );
            }
            return true;
        } catch (error) {
            console.error("Error saving connection:", error);
            throw error;
        }
    }

    async getConnections() {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        try {
            return await this.db.all(`
                SELECT id, name, host, port, database, user, password,
                       color, is_active, created_at, updated_at
                FROM connections
                ORDER BY name
            `);
        } catch (error) {
            console.error("Error getting connections:", error);
            throw error;
        }
    }

    async deleteConnection(id: number) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        try {
            await this.db.run("DELETE FROM connections WHERE id = ?", id);
            return true;
        } catch (error) {
            console.error("Error deleting connection:", error);
            throw error;
        }
    }
}
