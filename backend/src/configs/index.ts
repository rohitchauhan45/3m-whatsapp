import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import logger from "../libraries/log/logger";
import schema from "./config.schema";

export interface AppConfig {
  NODE_ENV: string;
  DATABASE_URL: string;
  RATE: number;
  PORT: number;
}

class Config {
  private static instance: Config;
  public config: AppConfig;

  private constructor() {
    logger.info("Loading and validating config for the first time...");
    this.config = this.loadAndValidateConfig();
    logger.info("Config loaded and validated");
  }

  private loadAndValidateConfig(): AppConfig {
    const environment = process.env.NODE_ENV || "development";

    // 1. Load environment file from known locations (root, src, dist)
    // Try environment-specific file first, then fallback to .env
    const envFile = `.env.${environment}`;
    const envLookups = [
      path.join(process.cwd(), envFile),
      path.join(__dirname, "..", envFile),
      path.join(__dirname, "..", "..", envFile),
    ];
    let envPath = envLookups.find((lookupPath) => fs.existsSync(lookupPath));
    
    // Fallback to plain .env file if environment-specific file not found
    if (!envPath) {
      const plainEnvLookups = [
        path.join(process.cwd(), ".env"),
        path.join(__dirname, "..", ".env"),
        path.join(__dirname, "..", "..", ".env"),
      ];
      envPath = plainEnvLookups.find((lookupPath) => fs.existsSync(lookupPath));
    }
    
    if (!envPath) {
      throw new Error(
        `Environment file not found. Looked for ${envFile} or .env in: ${envLookups.join(
          ", ",
        )}`,
      );
    }
    dotenv.config({ path: envPath });
    logger.info(`Loaded environment file: ${envPath}`);

    // 2. Load config file based on environment (optional - only if exists)
    const configFileName = `config.${environment}.json`;
    const configLookups = [
      path.join(process.cwd(), configFileName),
      path.join(process.cwd(), "src", "configs", configFileName),
      path.join(__dirname, configFileName),
    ];
    const configFile = configLookups.find((lookupPath) =>
      fs.existsSync(lookupPath),
    );

    let configFromFile: Record<string, unknown> = {};
    
    // Load environment-specific config file if it exists
    if (configFile) {
      try {
        configFromFile = JSON.parse(
          fs.readFileSync(configFile, "utf-8"),
        );
        logger.info(`Loaded config file: ${configFile}`);
      } catch (error) {
        logger.warn(`Failed to parse config file ${configFile}, using defaults`);
      }
    } else {
      logger.info(`Config file ${configFileName} not found, using environment variables only`);
    }

    // 3. Load shared config file (optional - only if exists)
    const sharedConfigLookups = [
      path.join(process.cwd(), "config.shared.json"),
      path.join(process.cwd(), "src", "configs", "config.shared.json"),
      path.join(__dirname, "config.shared.json"),
    ];
    const sharedConfigFile = sharedConfigLookups.find((lookupPath) =>
      fs.existsSync(lookupPath),
    );
    if (sharedConfigFile) {
      try {
        const sharedConfig = JSON.parse(
          fs.readFileSync(sharedConfigFile, "utf-8"),
        );
        configFromFile = { ...sharedConfig, ...configFromFile };
        logger.info(`Loaded shared config file: ${sharedConfigFile}`);
      } catch (error) {
        logger.warn(`Failed to parse shared config file ${sharedConfigFile}`);
      }
    }

    const finalConfig: Record<string, unknown> = {};
    // Get keys from schema shape
    const schemaKeys = Object.keys(schema.shape);
    for (const key of schemaKeys) {
      if (Object.prototype.hasOwnProperty.call(process.env, key)) {
        const value = process.env[key];
        // Convert string numbers to numbers for RATE and PORT
        if ((key === "RATE" || key === "PORT") && typeof value === "string") {
          finalConfig[key] = parseInt(value, 10);
        } else {
          finalConfig[key] = value;
        }
      } else if (Object.prototype.hasOwnProperty.call(configFromFile, key)) {
        finalConfig[key] = configFromFile[key]; // Fallback to config file value
      }
    }

    const result = schema.safeParse(finalConfig);
    if (!result.success) {
      const missingProperties = result.error.errors.map((err) => err.path.join("."));
      throw new Error(
        `Config validation error: ${result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    return result.data as AppConfig;
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

export default Config.getInstance().config;
